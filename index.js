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
// const { routeList, stopList } = JSON.parse(fs.readFileSync("routeFareList.min.json", "utf-8"));

const routeMap = new Map(Object.entries(routeList));
const stopMap = new Map(Object.entries(stopList));
const nodeMap = new Map();

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
          operator,
        });
      } else {
        const edg = edgeMap.get(key);
        edg.routes = edg.routes.concat(routeId);
        edgeMap.set(key, edg);
      }
      if (!nodeMap.has(from)) {
        nodeMap.set(from, Object.assign(stopMap.get(from), { id: from, routes: [] }));
      }
      if (!nodeMap.has(to)) {
        nodeMap.set(to, Object.assign(stopMap.get(to), { id: to, routes: [] }));
      }
      const fromNode = nodeMap.get(from);
      fromNode.routes = fromNode.routes.concat(routeId);
      nodeMap.set(from, fromNode);

      const toNode = nodeMap.get(to);
      toNode.routes = toNode.routes.concat(routeId);
      nodeMap.set(to, toNode);
    }
  }
}
console.log(
  `${nodeMap.size}/${stopMap.size} nodes (${stopMap.size - nodeMap.size} disconnected), ${
    edgeMap.size
  } edges`
);

console.log("No route to these bus stops:");
for (const stopId of Array.from(stopMap.keys())) {
  if (!nodeMap.has(stopId)) {
    console.log(stopId, stopMap.get(stopId).name.zh);
  }
}

fs.writeFileSync(
  "nodes.json",
  JSON.stringify(
    Array.from(nodeMap).map((e) => ({
      borderWidth: 0,
      borderWidthSelected: 1,
      id: e[0],
      value: new Set(e[1].routes?.map((e) => e.split("+")[0])).size,
      label: e[1].name.zh,
      shape: "hexagon",
      title: Array.from(new Set(e[1].routes?.map((e) => e.split("+")[0]))).join(","),
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
      arrows: {
        to: {
          enabled: true,
          scaleFactor: 0.5,
        },
      },
      scaling: {
        label: {
          min: 8,
          max: 8,
        },
      },
      from: e[1].from,
      to: e[1].to,
      value: e[1].routes.length,
      title: Array.from(new Set(e[1].routes?.map((e) => e.split("+")[0]))).join(","),
      label: `${e[1].distance | 0}`,
      color: { kmb: "red", ctb: "#d9d100", nlb: "orange", nwfb: "purple" }[e[1].operator],
    })),
    null,
    2
  )
);

// console.log(
//   // busiest paths
//   Array.from(edgeMap)
//     .map((e) => ({
//       from: stopMap.get(e[1].from).name.zh,
//       to: stopMap.get(e[1].to).name.zh,
//       count: Array.from(new Set(e[1].routes.map((e) => e.split("+")[0]))).length,
//       routes: Array.from(new Set(e[1].routes.map((e) => e.split("+")[0]))).join(","),
//     }))
//     .sort((a, b) => b.count - a.count)
//     .slice(0, 10)
// );

// console.log(
//   // longest paths
//   Array.from(edgeMap)
//     .map((e) => ({
//       from: stopMap.get(e[1].from).name.zh,
//       to: stopMap.get(e[1].to).name.zh,
//       distance: e[1].distance,
//       routes: Array.from(new Set(e[1].routes.map((e) => e.split("+")[0]))).join(","),
//     }))
//     .sort((a, b) => b.distance - a.distance)
//     .slice(0, 10)
// );

// console.log(
//   // shortest paths
//   Array.from(edgeMap)
//     .map((e) => ({
//       from: stopMap.get(e[1].from).name.zh,
//       to: stopMap.get(e[1].to).name.zh,
//       distance: e[1].distance,
//       routes: Array.from(new Set(e[1].routes.map((e) => e.split("+")[0]))).join(","),
//     }))
//     .filter((e) => !(e.from === e.to || e.from.match(/(轉車|總站)/) || e.to.match(/(轉車|總站)/)))
//     .sort((a, b) => a.distance - b.distance)
//     .slice(0, 10)
// );
