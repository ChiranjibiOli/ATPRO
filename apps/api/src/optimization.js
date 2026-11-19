/** Pure, read-only directed open-route optimization. Indices: 0=driver, 1..n=pickups, n+1=market. */
const fail = message => { throw new TypeError(message); };
export function validateRoutingProblem(problem) {
  const { pickups, distancesMeters, durationsSeconds, vehicleCapacityKg, maxRouteSeconds = Infinity } = problem ?? {};
  if (!Array.isArray(pickups) || pickups.length < 1 || pickups.length > 23) fail('Expected 1–23 pickups.');
  if (!Number.isFinite(vehicleCapacityKg) || vehicleCapacityKg <= 0 || vehicleCapacityKg > 50000) fail('Invalid vehicle capacity.');
  if (!(maxRouteSeconds === Infinity || (Number.isFinite(maxRouteSeconds) && maxRouteSeconds > 0))) fail('Invalid route duration limit.');
  const n = pickups.length + 2;
  for (const matrix of [distancesMeters, durationsSeconds]) {
    if (!Array.isArray(matrix) || matrix.length !== n || !matrix.every(row => Array.isArray(row) && row.length === n && row.every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0))) fail('Invalid directed road matrix.');
  }
  const ids = new Set();
  for (const pickup of pickups) {
    if (typeof pickup?.id !== 'string' || !pickup.id.trim() || ids.has(pickup.id)) fail('Pickup IDs must be unique nonempty strings.');
    ids.add(pickup.id);
    if (!Number.isFinite(pickup.weightKg) || pickup.weightKg <= 0 || pickup.weightKg > 50000) fail('Invalid pickup weight.');
    if (pickup.maxTransitSeconds !== undefined && (!Number.isFinite(pickup.maxTransitSeconds) || pickup.maxTransitSeconds <= 0)) fail('Invalid perishability limit.');
    for (const key of ['earliestArrivalSeconds','latestArrivalSeconds']) if (pickup[key] !== undefined && (!Number.isFinite(pickup[key]) || pickup[key] < 0)) fail('Invalid pickup arrival window.');
    if (pickup.earliestArrivalSeconds !== undefined && pickup.latestArrivalSeconds !== undefined && pickup.earliestArrivalSeconds > pickup.latestArrivalSeconds) fail('Invalid pickup window ordering.');
  }
  return n;
}
export function evaluatePickupRoute(problem, order, compatible = () => true) {
  const n = validateRoutingProblem(problem), market = n - 1;
  if (!Array.isArray(order) || new Set(order).size !== order.length || order.some(i => !Number.isInteger(i) || i < 1 || i >= market)) fail('Invalid pickup order.');
  if (typeof compatible !== 'function') fail('Compatibility validator must be a function.');
  const { pickups, distancesMeters: d, durationsSeconds: t, vehicleCapacityKg, maxRouteSeconds = Infinity } = problem;
  const weightGrams = order.reduce((sum,i) => sum + Math.ceil(pickups[i-1].weightKg * 1000 - 1e-7),0);
  if (weightGrams > Math.floor(vehicleCapacityKg * 1000 + 1e-7)) return { feasible:false, reason:'capacity' };
  if (!compatible(order.map(i => pickups[i-1]))) return { feasible:false, reason:'product_compatibility' };
  const nodes = [0,...order,market];
  let distanceMeters = 0, durationSeconds = 0;
  const arrivals = new Map();
  for (let i=0;i<nodes.length-1;i++) {
    const a=nodes[i], b=nodes[i+1];
    distanceMeters += d[a][b]; durationSeconds += t[a][b];
    if (b !== market) {
      const p=pickups[b-1];
      if (p.earliestArrivalSeconds !== undefined && durationSeconds < p.earliestArrivalSeconds) durationSeconds=p.earliestArrivalSeconds;
      if (p.latestArrivalSeconds !== undefined && durationSeconds > p.latestArrivalSeconds) return {feasible:false,reason:'pickup_window'};
      arrivals.set(b,durationSeconds);
    }
  }
  if (durationSeconds > maxRouteSeconds) return {feasible:false,reason:'driver_availability'};
  for (const index of order) {
    const max=pickups[index-1].maxTransitSeconds;
    if (max !== undefined && durationSeconds-arrivals.get(index)>max) return {feasible:false,reason:'perishability'};
  }
  return {feasible:true,order:[...order],distanceMeters,durationSeconds,weightKg:weightGrams/1000};
}
/** Savings measured against two separate open D→pickup→M routes, never a closed-depot cycle. */
export function clarkeWrightOpenRoutes(problem, compatible = () => true) {
  const n=validateRoutingProblem(problem), d=problem.distancesMeters, market=n-1;
  const singles=problem.pickups.map((_,i)=>[i+1]);
  const unassigned=singles.filter(r=>!evaluatePickupRoute(problem,r,compatible).feasible).map(r=>problem.pickups[r[0]-1].id);
  let routes=singles.filter(r=>evaluatePickupRoute(problem,r,compatible).feasible);
  while (true) {
    let best=null;
    for (let a=0;a<routes.length;a++) for (let b=a+1;b<routes.length;b++) {
      const ra=routes[a],rb=routes[b];
      for (const left of [ra,[...ra].reverse()]) for (const right of [rb,[...rb].reverse()]) {
        const joined=[...left,...right];
        const evaluation=evaluatePickupRoute(problem,joined,compatible);
        if (!evaluation.feasible) continue;
        const cost=r=>d[0][r[0]]+r.slice(1).reduce((s,v,i)=>s+d[r[i]][v],0)+d[r.at(-1)][market];
        const saving=cost(ra)+cost(rb)-evaluation.distanceMeters;
        const key=joined.map(i=>problem.pickups[i-1].id).join('\u0000');
        if (saving>1e-9 && (!best || saving>best.saving+1e-9 || (Math.abs(saving-best.saving)<=1e-9 && key<best.key))) best={a,b,joined,saving,key};
      }
    }
    if (!best) break;
    routes=routes.filter((_,i)=>i!==best.a&&i!==best.b);
    routes.push(best.joined);
    routes.sort((a,b)=>a.map(i=>problem.pickups[i-1].id).join('\u0000').localeCompare(b.map(i=>problem.pickups[i-1].id).join('\u0000')));
  }
  return {
    routes:routes.map(order=>evaluatePickupRoute(problem,order,compatible)),
    unassigned,
    note:'Read-only directed open-route heuristic. No reservation, route guarantee or Driver acceptance.'
  };
}
/** Full directed cost recomputation matters: reversing an asymmetric road segment changes internal arcs. */
export function improveFixedEndpointTwoOpt(problem, initialOrder, compatible = () => true) {
  let current=evaluatePickupRoute(problem,initialOrder,compatible);
  if (!current.feasible) return { ...current, improvements:0 };
  let improvements=0;
  const cap=Math.max(1,initialOrder.length*initialOrder.length*10);
  while (improvements<cap) {
    let best=null;
    for(let i=0;i<current.order.length;i++) for(let j=i+1;j<current.order.length;j++) {
      const order=[...current.order.slice(0,i),...current.order.slice(i,j+1).reverse(),...current.order.slice(j+1)];
      const next=evaluatePickupRoute(problem,order,compatible);
      if(next.feasible && next.distanceMeters<current.distanceMeters-1e-9 &&
         (!best || next.distanceMeters<best.distanceMeters-1e-9 ||
          (Math.abs(next.distanceMeters-best.distanceMeters)<=1e-9 && order.join(',')<best.order.join(',')))) best=next;
    }
    if(!best) break;
    current=best; improvements++;
  }
  return {...current,improvements,note:'Read-only local improvement, not a globally optimal or accepted trip.'};
}
