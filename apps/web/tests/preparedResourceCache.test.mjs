import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPreparedResourceCache } from '../src/features/library/lib/preparedResourceCache.ts'

test('preparation is shared and taking a resource transfers its ownership', async () => {
 const disposed=[];const cache=createPreparedResourceCache(2,v=>disposed.push(v));let reads=0
 const resource={};await Promise.all([cache.warm('a',async()=>{reads++;return resource}),cache.warm('a',async()=>{reads++;return {}})])
 assert.equal(reads,1);assert.equal(cache.take('a'),resource);assert.equal(cache.take('a'),undefined)
 cache.invalidate('a');assert.deepEqual(disposed,[])
})
test('invalidating pending preparation disposes a late result instead of caching stale layers', async () => {
 const disposed=[];const cache=createPreparedResourceCache(2,v=>disposed.push(v));let finish
 const pending=cache.warm('a',()=>new Promise(r=>{finish=r}));cache.invalidate('a');finish('old');await pending
 assert.equal(cache.take('a'),undefined);assert.deepEqual(disposed,['old'])
})
test('bounded preparation disposes the least recently used canvas', async () => {
 const disposed=[];const cache=createPreparedResourceCache(2,v=>disposed.push(v))
 await cache.warm('a',async()=>1);await cache.warm('b',async()=>2);await cache.warm('c',async()=>3)
 assert.deepEqual(disposed,[1]);assert.equal(cache.take('a'),undefined);assert.equal(cache.take('c'),3)
})
test('failed preparation can be retried', async () => {
 const cache=createPreparedResourceCache(2,()=>{});await cache.warm('a',async()=>{throw Error('decode failed')})
 await cache.warm('a',async()=>42);assert.equal(cache.take('a'),42)
})
