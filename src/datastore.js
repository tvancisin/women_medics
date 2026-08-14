import * as d3 from "d3";
export const historicalEvents = [
  {
    startYear: 1740,
    endYear: 1800,
    description: "Scottish Enlightenment →"
  },
  // {
  //   startYear: 1884,
  //   endYear: 1885,
  //   description: "Triple Qualifications →"
  // },
  // {
  //   startYear: 1886,
  //   endYear: 1887,
  //   description: "School of Medicine for Women →"
  // },
  // {
  //   startYear: 1889,
  //   endYear: 1890,
  //   description: "College of Medicine for Women →"
  // },
  // {
  //   startYear: 1892,
  //   endYear: 1893,
  //   description: "Women admitted to universities →"
  // },
  // {
  //   startYear: 1832,
  //   endYear: 1903,
  //   description: "Suffrage →"
  // },
  {
    startYear: 1914,
    endYear: 1918,
    description: "The First World War →"
  },
  // {
  //   startYear: 1928,
  //   endYear: 1929,
  //   description: "Voting Rights →"
  // },
  {
    startYear: 1939,
    endYear: 1945,
    description: "The Second World War →"
  },
];

export async function getIndividualCSV(path) {
  let loadedData = await d3.csv(path);
  return loadedData;
}

export async function getCSV(paths) {
  const promises = paths.map(path => getIndividualCSV(path));
  const results = await Promise.all(promises);
  return results;
}

export async function getIndividualJSON(path) {
  let loadedData = await d3.json(path);
  return loadedData;
}

export async function getJson(paths) {
  const promises = paths.map(path => getIndividualJSON(path));
  const results = await Promise.all(promises);
  return results;
}
