import fs from "fs";
import fetch from "node-fetch";

const getDistance = (a, b) => {
  const R = 6371e3; // metres
  const φ1 = (a.lat * Math.PI) / 180; // φ, λ in radians
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;

  const aa =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c; // in metres
};

const { routeList, stopList } = await fetch(
  "https://hkbus.github.io/hk-bus-crawling/routeFareList.min.json"
).then((r) => r.json());

const routeMap = new Map(Object.entries(routeList));
const stopMap = new Map(Object.entries(stopList));
const nodeMap = stopMap;

const edgeMap = new Map();
for (const [routeId, { stops }] of Object.entries(routeList)) {
  for (const [operator, stopIdList] of Object.entries(stops)) {
    for (let i = 0; i < stopIdList.length - 1; i++) {
      const from = stopIdList[i];
      const to = stopIdList[i + 1];
      const key = `${from} => ${to}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, {
          from,
          to,
          distance: getDistance(stopMap.get(from).location, stopMap.get(to).location),
          routes: [routeId],
        });
      } else {
        const { from, to, distance, routes } = edgeMap.get(key);
        edgeMap.set(key, {
          from,
          to,
          distance,
          routes: routes.concat(routeId),
        });
      }
      const fromNode = nodeMap.get(from);
      if (!fromNode.next) fromNode.next = new Set();
      fromNode.next.add(to);
      if (!fromNode.routes) fromNode.routes = [];
      fromNode.routes = fromNode.routes.concat(routeId);
      nodeMap.set(from, fromNode);
    }
  }
}

fs.writeFileSync(
  "nodes.json",
  JSON.stringify(
    Array.from(nodeMap).map((e) => ({
      id: e[0],
      value: new Set(e[1].routes?.map((e) => e.split("-")[0])).size,
      label: e[1].name.zh,
      x: (e[1].location.lng - 114) * 100000,
      y: (e[1].location.lat - 22) * 100000 * -1,
    })),
    null,
    2
  )
);

fs.writeFileSync(
  "edges.json",
  JSON.stringify(
    Array.from(edgeMap).map((e) => ({
      from: e[1].from,
      to: e[1].to,
      value: e[1].routes.length,
      length: e[1].distance,
    })),
    null,
    2
  )
);

// const busiestPaths = Array.from(edgeMap)
//   .map((e) => ({
//     from: stopMap.get(e[1].from).name.zh,
//     to: stopMap.get(e[1].to).name.zh,
//     count: Array.from(new Set(e[1].routes.map((e) => e.split("-")[0]))).length,
//     routes: Array.from(new Set(e[1].routes.map((e) => e.split("-")[0]))).join(","),
//   }))
//   .sort((a, b) => b.count - a.count)
//   .slice(0, 5);
// console.log(busiestPaths);
