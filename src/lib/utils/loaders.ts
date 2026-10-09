import * as d3 from "d3";

export async function getIndividualCSV(path: string) {
  const loadedData = await d3.csv(path);
  return loadedData;
}

export async function getCSV(paths: string[]) {
  const promises = paths.map((path) => getIndividualCSV(path));
  const results = await Promise.all(promises);
  return results;
}

export async function getIndividualJSON(path: string) {
  const loadedData = await d3.json(path);
  return loadedData;
}

export async function getJson(paths: string[]) {
  const promises = paths.map((path) => getIndividualJSON(path));
  const results = await Promise.all(promises);
  return results;
}
