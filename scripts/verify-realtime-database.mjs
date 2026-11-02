// TEST_DATABASE_URL must point to a disposable local PostgreSQL database.
// PGLITE_MODULE optionally selects an installed PGlite module for embedded SQL checks.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';

let db, listener, notifications=[], close;
if(process.env.PGLITE_MODULE) {
  const { PGlite } = await import(process.env.PGLITE_MODULE);
  db=new PGlite();
  await db.listen('auction_changes', payload=>notifications.push(JSON.parse(payload)));
  close=()=>db.close();
} else {
  if(!process.env.TEST_DATABASE_URL || !['localhost','127.0.0.1','::1','[::1]'].includes(new URL(process.env.TEST_DATABASE_URL).hostname)) throw new Error('Set TEST_DATABASE_URL to a disposable local database, or PGLITE_MODULE for embedded verification');
  db=new Client({connectionString:process.env.TEST_DATABASE_URL});
  listener=new Client({connectionString:process.env.TEST_DATABASE_URL});
  await db.connect(); await listener.connect();
  listener.on('notification', event=>notifications.push(JSON.parse(event.payload)));
  await listener.query('LISTEN auction_changes');
  close=async()=>{await listener.end();await db.end();};
}
const schema=`sse_test_${Date.now()}`;
try {
  await db.query(`CREATE SCHEMA ${schema}`);
  await db.query(`SET search_path TO ${schema},public`);
  const initial=await readFile('prisma/migrations/20261102160000_postgres_auction_storage/migration.sql','utf8');
  const realtime=await readFile('prisma/migrations/20261102180000_auction_realtime/migration.sql','utf8');
  const execute=sql=>db.exec ? db.exec(sql) : db.query(sql);
  // PGlite has gen_random_uuid built in but does not bundle the pgcrypto extension.
  await execute(process.env.PGLITE_MODULE ? initial.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;','') : initial);
  await execute(realtime);
  const league='verify-'+Date.now();
  await db.query('INSERT INTO auction_leagues(id,data,rules) VALUES($1,$2,$3)',[league,{id:league,name:'Test'},{seasonId:league}]);
  await db.query('INSERT INTO auction_states(league_id,data) VALUES($1,$2)',[league,{seasonId:league,status:'IDLE'}]);
  const cursor=async()=>Number((await db.query('SELECT revision FROM auction_revisions WHERE league_id=$1',[league])).rows[0].revision);
  const original=await cursor();
  await db.query('BEGIN');
  await db.query('UPDATE auction_states SET version=version+1 WHERE league_id=$1',[league]);
  await db.query('ROLLBACK');
  assert.equal(await cursor(),original,'rollback must restore revision');
  await new Promise(resolve=>setTimeout(resolve,30)); notifications=[];
  await db.query('BEGIN');
  await db.query('UPDATE auction_states SET version=version+1 WHERE league_id=$1',[league]);
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(notifications.length,0,'uncommitted changes must not notify');
  await db.query('COMMIT');
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(notifications.length,1);
  assert.deepEqual(Object.keys(notifications[0]).sort(),['leagueId','revision']);
  for(const table of ['auction_teams','auction_players','auction_bids','auction_purchases']) {
    const before=await cursor();
    await db.query(`INSERT INTO ${table}(league_id,id,data) VALUES($1,$2,$3)`,[league,'entity',{}]);
    await db.query(`UPDATE ${table} SET data=$2 WHERE league_id=$1`,[league,{changed:true}]);
    await db.query(`DELETE FROM ${table} WHERE league_id=$1`,[league]);
    assert.equal(await cursor(),before+3,`${table} insert/update/delete must advance cursor`);
  }
  const before=await cursor();
  await db.query('UPDATE auction_leagues SET rules=$2,data=$3 WHERE id=$1',[league,{changed:true},{id:league,name:'Renamed'}]);
  assert.equal(await cursor(),before+1,'rules and branding must advance cursor');
  await db.query('DELETE FROM auction_leagues WHERE id=$1',[league]);
  assert.equal((await db.query('SELECT * FROM auction_revisions WHERE league_id=$1',[league])).rows.length,0);
  console.log(`PASS: ${process.env.PGLITE_MODULE?'embedded PostgreSQL':'separate PostgreSQL sessions'} migration, commit-only notifications, rollback, entity revisions, configuration edits, cascade deletion`);
} finally {
  await db.query('SET search_path TO public');
  await db.query(`DROP SCHEMA ${schema} CASCADE`);
  await close();
}
