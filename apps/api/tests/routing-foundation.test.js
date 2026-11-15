import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCoordinates, osrmCoordinate } from '../src/geo.js';
import { roadMatrix, RoutingUnavailableError } from '../src/osrm.js';

const points = [{ latitude: 27.7, longitude: 85.3 }, { latitude: 27.8, longitude: 85.4 }];
test('coordinates validate numeric boundaries and reject incomplete, invalid and string inputs', () => {
  for (const p of [{latitude:0,longitude:0},{latitude:-90,longitude:180},{latitude:90,longitude:-180}])
    assert.equal(validateCoordinates(p).valid, true);
  for (const p of [null,{}, {latitude:91,longitude:0},{latitude:0,longitude:-181},{latitude:'27',longitude:85},{latitude:NaN,longitude:0},{latitude:0,longitude:Infinity}])
    assert.equal(validateCoordinates(p).valid, false);
  assert.equal(osrmCoordinate(points[0]), '85.3,27.7');
  assert.throws(() => osrmCoordinate({longitude:85.3}), TypeError);
});
test('matrix uses lon,lat order and preserves asymmetric meters and seconds', async () => {
  let request;
  const result = await roadMatrix(points, { fetchImpl: async (url, options) => {
    request = {url,options};
    return {ok:true,json:async()=>({code:'Ok',distances:[[0,1100],[1200,0]],durations:[[0,180],[210,0]]})};
  }});
  assert.match(request.url, /85\.3,27\.7;85\.4,27\.8/);
  assert.match(request.url, /annotations=distance%2Cduration/);
  assert.equal(request.options.method,'GET');
  assert.deepEqual(result.distancesMeters, [[0,1100],[1200,0]]);
  assert.deepEqual(result.durationsSeconds, [[0,180],[210,0]]);
});
test('rejects unreachable matrix, invalid response, HTTP error and routing failure', async () => {
  const fetchResult = value => async () => ({ok:true,json:async()=>value});
  for (const data of [
    {code:'NoRoute'}, {code:'Ok',distances:[[0,null],[1,0]],durations:[[0,2],[2,0]]},
    {code:'Ok',distances:[[0,1]],durations:[[0,1]]},
    {code:'Ok',distances:[[0,-1],[1,0]],durations:[[0,2],[2,0]]},
  ]) await assert.rejects(roadMatrix(points,{fetchImpl:fetchResult(data)}), RoutingUnavailableError);
  await assert.rejects(roadMatrix(points,{fetchImpl:async()=>({ok:false})}), RoutingUnavailableError);
  await assert.rejects(roadMatrix(points,{fetchImpl:async()=>{throw new Error('timeout')}}), RoutingUnavailableError);
});
test('validates bounds and blocks insecure or local routing endpoints', async () => {
  await assert.rejects(roadMatrix([points[0]]), TypeError);
  await assert.rejects(roadMatrix(Array(26).fill(points[0])), TypeError);
  for (const baseUrl of ['http://router.project-osrm.org','https://localhost','https://127.0.0.1','https://10.0.0.2','https://router.project-osrm.org/path','https://u:p@router.project-osrm.org'])
    await assert.rejects(roadMatrix(points,{baseUrl}), TypeError);
});
