// Runs transport lifecycle tests without network access or hosted database writes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const snapshotUrl = moduleUrl(compile(await readFile('src/lib/realtime/snapshot.ts', 'utf8')));
const { mapSnapshot, publicSnapshot } = await import(snapshotUrl);
const row = { league: { id:'test', slug:'test', name:'Test', primaryColor:'#000', secondaryColor:'#fff', googleSheetsUrl:'private', importMetadata:{secret:true} },
  rules: {seasonId:'test',initialTimerSeconds:30,bidExtensionSeconds:10}, state: {id:'auction-test',seasonId:'test',status:'PAUSED',currentPlayerId:null,currentHighestBid:0,currentLeadingTeamId:null,timerSeconds:30,timerExpiresAt:'',version:7},
  version:7,revision:'50',teams:[],players:[],bids:[] };
assert.equal(mapSnapshot(row).session.version,7);
assert.equal(mapSnapshot(row).session.revision,50);
const publicState = publicSnapshot(mapSnapshot(row));
assert.equal(publicState.league.googleSheetsUrl,undefined);
assert.equal(publicState.league.importMetadata,undefined);

// Substitute only the database transport. Exercise the actual Edge route's Web Streams lifecycle.
const clients = new Set();
class FakeClient {
  handlers = new Map();
  constructor(){ clients.add(this); }
  on(name, handler){ this.handlers.set(name,handler); }
  async connect(){
    if(FakeClient.failConnect) throw new Error("Simulated database connect failure");
  }
  async query(sql){
    if (sql.startsWith('LISTEN')) {
      this.listening=true;
      const hook=FakeClient.listenHook; FakeClient.listenHook=undefined;
      if(hook) hook(this);
      return {rows:[]};
    }
    assert.ok(this.listening,'subscription must precede snapshot');
    if(this.failRead) throw new Error("Simulated snapshot read failure");
    const snapshot=structuredClone(row);
    const hook=FakeClient.snapshotHook;
    FakeClient.snapshotHook=undefined;
    if(hook) hook(this);
    return {rows:[snapshot]};
  }
  async end(){ clients.delete(this); }
}
globalThis.__auctionTestClient = FakeClient;
let source = await readFile('src/app/api/realtime/stream/route.ts','utf8');
source = source.replace('import { Client } from "@neondatabase/serverless";', 'const Client = globalThis.__auctionTestClient;')
  .replace('"@/lib/realtime/snapshot"', JSON.stringify(snapshotUrl));
const { GET } = await import(moduleUrl(compile(source)));
const previous = process.env.DATABASE_DIRECT_URL;
process.env.DATABASE_DIRECT_URL = 'postgresql://test:test@ep-test.neon.tech/test';
const decoder = new TextDecoder();
const frame = async reader => {
  let deadline;
  const timeout=new Promise((_,reject)=>{deadline=setTimeout(()=>reject(new Error('Timed out reading SSE')),2000);});
  try {
    for (;;) { const result=await Promise.race([reader.read(),timeout]); assert.equal(result.done,false); const text=decoder.decode(result.value); if(text.includes('data: {'))return JSON.parse(text.split('data: ')[1]); }
  } finally {clearTimeout(deadline);}
};
try {
  const viewers = await Promise.all(Array.from({length:25}, async () => {
    const abort = new AbortController();
    const response=await GET(new Request('https://example.test/api/realtime/stream?leagueId=test',{signal:abort.signal}));
    assert.equal(response.headers.get('content-type'),'text/event-stream; charset=utf-8');
    const reader=response.body.getReader();
    assert.equal((await frame(reader)).revision,50);
    return {abort,reader};
  }));
  assert.equal(clients.size,25);
  row.revision='51'; row.version=8; row.state.currentHighestBid=2000;
  const started=performance.now();
  for(const client of clients) client.handlers.get('notification')({payload:JSON.stringify({leagueId:'test',revision:51})});
  const updates=await Promise.all(viewers.map(v=>frame(v.reader)));
  assert.ok(updates.every(u=>u.revision===51 && u.session.currentHighestBid===2000));
  console.log(`25 simulated Edge streams received revision 51 in ${Math.round(performance.now()-started)}ms`);
  await Promise.all(viewers.map(v=>v.reader.cancel()));
  assert.equal(clients.size,0,'cancellation must close all DB clients');
  const abort=new AbortController();
  const response=await GET(new Request('https://example.test/api/realtime/stream?leagueId=test',{signal:abort.signal}));
  const reader=response.body.getReader(); await frame(reader); abort.abort();
  assert.equal(clients.size,0,'request abort must close DB client');
  // A committed update during the first SELECT must schedule a second read.
  FakeClient.snapshotHook=client=>{
    row.revision='52'; row.state.currentHighestBid=3000;
    client.handlers.get('notification')({payload:JSON.stringify({leagueId:'test',revision:52})});
  };
  const raceResponse=await GET(new Request('https://example.test/api/realtime/stream?leagueId=test'));
  const raceReader=raceResponse.body.getReader();
  assert.equal((await frame(raceReader)).revision,51);
  assert.equal((await frame(raceReader)).revision,52,'update during snapshot must not be missed');
  await raceReader.cancel();

  // Simulate scheduled timers without waiting four minutes or retaining real handles.
  const originals={setTimeout,clearTimeout,setInterval,clearInterval};
  const timeouts=new Map(), intervals=new Map();
  globalThis.setTimeout=(callback,delay,...args)=>{
    if(delay===240000) {const handle={delay};timeouts.set(handle,()=>callback(...args));return handle;}
    return originals.setTimeout(callback,delay,...args);
  };
  globalThis.clearTimeout=handle=>{if(!timeouts.delete(handle))originals.clearTimeout(handle);};
  globalThis.setInterval=(callback,delay,...args)=>{const handle={delay};intervals.set(handle,()=>callback(...args));return handle;};
  globalThis.clearInterval=handle=>{if(!intervals.delete(handle))originals.clearInterval(handle);};
  try {
    const abortedDuringListen=new AbortController();
    FakeClient.listenHook=()=>abortedDuringListen.abort();
    const abortedResponse=await GET(new Request('https://example.test/api/realtime/stream?leagueId=test',{signal:abortedDuringListen.signal}));
    assert.equal(abortedResponse.status,499,'abort during LISTEN must not start a stream');
    assert.equal(clients.size,0,'abort during LISTEN must release database client');
    assert.equal(timeouts.size,0,'abort during LISTEN must not install lifetime timers');
    assert.equal(intervals.size,0,'abort during LISTEN must not install heartbeat timers');

    const rotationResponse=await GET(new Request('https://example.test/api/realtime/stream?leagueId=test'));
    const rotationReader=rotationResponse.body.getReader(); await frame(rotationReader);
    assert.equal(timeouts.size,1,'one bounded stream lifetime must be scheduled');
    assert.equal(intervals.size,1,'one heartbeat must be scheduled');
    [...intervals.values()][0]();
    const heartbeat=decoder.decode((await rotationReader.read()).value);
    assert.match(heartbeat,/event: heartbeat/);
    [...timeouts.values()][0]();
    assert.equal((await rotationReader.read()).done,true,'rotation must close the stream');
    assert.equal(clients.size,0,'rotation must release the database session');
    assert.equal(timeouts.size,0); assert.equal(intervals.size,0);

    const errorResponse=await GET(new Request('https://example.test/api/realtime/stream?leagueId=test'));
    const errorReader=errorResponse.body.getReader(); await frame(errorReader);
    [...clients][0].handlers.get('error')(new Error('Simulated database socket error'));
    assert.equal((await errorReader.read()).done,true,'database errors must close streams');
    assert.equal(clients.size,0);assert.equal(timeouts.size,0);assert.equal(intervals.size,0);

    const failedReadResponse=await GET(new Request('https://example.test/api/realtime/stream?leagueId=test'));
    const failedReadReader=failedReadResponse.body.getReader(); await frame(failedReadReader);
    const failedClient=[...clients][0]; failedClient.failRead=true;
    failedClient.handlers.get('notification')({payload:JSON.stringify({leagueId:'test',revision:53})});
    assert.equal((await failedReadReader.read()).done,true,'snapshot errors must close streams');
    assert.equal(clients.size,0);assert.equal(timeouts.size,0);assert.equal(intervals.size,0);
  } finally {
    Object.assign(globalThis,originals);
  }
  FakeClient.failConnect=true;
  assert.equal((await GET(new Request('https://example.test/api/realtime/stream?leagueId=test'))).status,503);
  assert.equal(clients.size,0,'connect failures must release database clients');
  FakeClient.failConnect=false;
  process.env.DATABASE_DIRECT_URL='not a valid database URL';
  assert.equal((await GET(new Request('https://example.test/api/realtime/stream'))).status,503,'malformed configuration must return controlled 503');
  assert.equal(clients.size,0,'invalid configuration must not allocate database clients');
  process.env.DATABASE_DIRECT_URL='postgresql://test:test@ep-test-pooler.neon.tech/test';
  assert.equal((await GET(new Request('https://example.test/api/realtime/stream'))).status,503);
  console.log('PASS: snapshot mapping, private metadata exclusion, subscribe-before-read, 25-stream fan-out, snapshot race recovery, heartbeat, rotation, database error cleanup, cancellation, abort during LISTEN, malformed configuration, pooler rejection');
} finally {
  if(previous===undefined)delete process.env.DATABASE_DIRECT_URL;else process.env.DATABASE_DIRECT_URL=previous;
  delete globalThis.__auctionTestClient;
}
