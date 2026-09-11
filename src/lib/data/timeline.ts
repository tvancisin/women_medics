export const historicalEvents = [
  // {
  //   startYear: 1740,
  //   endYear: 1800,
  //   description: "Scottish Enlightenment"
  // },
  // {
  //   startYear: 1884,
  //   endYear: 1885,
  //   description: "Triple Qualifications"
  // },
  // {
  //   startYear: 1886,
  //   endYear: 1887,
  //   description: "School of Medicine for Women"
  // },
  // {
  //   startYear: 1889,
  //   endYear: 1890,
  //   description: "College of Medicine for Women"
  // },
  // {
  //   startYear: 1892,
  //   endYear: 1893,
  //   description: "Women admitted to universities"
  // },
  // {
  //   startYear: 1832,
  //   endYear: 1903,
  //   description: "Suffrage"
  // },
  {
    startYear: 1914,
    endYear: 1918,
    description: "The First World War"
  },
  // {
  //   startYear: 1928,
  //   endYear: 1929,
  //   description: "Voting Rights"
  // },
  {
    startYear: 1939,
    endYear: 1945,
    description: "The Second World War"
  },
];

export type ImageMarkerConfig = {
  id: string;
  year: number;
  coordinates: [number, number];
  alt: string;
};

export const timelineImageMarkers: ImageMarkerConfig[] = [
  {
    id: "university-founded",
    year: 1583,
    coordinates: [55.94741706177913, -3.1872452967325717],
    alt: "University of Edinburgh",
  },
  {
    id: "school-of-medicine",
    year: 1726,
    coordinates: [55.94741706177913, -3.1872452967325717],
    alt: "School of Medicine",
  },
  {
    id: "school-of-medicine",
    year: 1726,
    coordinates: [55.94843874572865, -3.1832826837322448],
    alt: "Old Surgeon's Hall",
  },
  {
    id: "first-classes",
    year: 1867,
    coordinates: [55.953587, -3.205565],
    alt: "68-73 Queen Street",
  },
  {
    id: "physiology",
    year: 1875,
    coordinates: [55.96018424065475, -3.1874283008879383],
    alt: "18 East London Street",
  },
  {
    id: "school",
    year: 1886,
    coordinates: [55.94884986998478, -3.1830358396746496],
    alt: "School of Medicine for Women",
  },
  {
    id: "college",
    year: 1889,
    coordinates: [55.94772479242563, -3.1889092603064184],
    alt: "College of Medicine for Women",
  },
];
