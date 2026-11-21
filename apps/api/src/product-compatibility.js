/** Conservative co-loading policy. No crop-specific odor/fragility metadata exists yet. */
const CLASSES=new Set(['standard','fragile','chilled']);
export function compatibleHandlingPair(a,b) {
  return CLASSES.has(a?.handling) && CLASSES.has(b?.handling) && a.handling===b.handling;
}
export function compatibleHandlingLoad(requests) {
  return Array.isArray(requests) && requests.every((a,i)=>requests.slice(i+1).every(b=>compatibleHandlingPair(a,b))) &&
    requests.every(r=>CLASSES.has(r?.handling));
}
