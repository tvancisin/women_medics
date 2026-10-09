export const historicalEvents = [
  {
    startYear: 1628,
    endYear: 1629,
    description: "BLOOD CIRCULATION",
  },
  {
    startYear: 1670,
    endYear: 1680,
    description: "FIRST MICROORGANISMS OBSERVED",
  },
  {
    startYear: 1740,
    endYear: 1800,
    description: "SCOTTISH ENLIGHTENMENT",
  },
  {
    startYear: 1840,
    endYear: 1850,
    description: "LONDON-EDINBURGH RAIL",
  },
  {
    startYear: 1879,
    endYear: 1880,
    description: "ROYAL INFIRMARY (NOW EFI)",
  },

  // {
  //   startYear: 1884,
  //   endYear: 1885,
  //   description: "TRIPLE QUALIFICATIONS"
  // },
  // {
  //   startYear: 1892,
  //   endYear: 1893,
  //   description: "WOMEN ADMITTED TO UNIVERSITIES"
  // },
  // {
  //   startYear: 1832,
  //   endYear: 1903,
  //   description: "SUFFRAGE"
  // },
  {
    startYear: 1914,
    endYear: 1918,
    description: "WW1",
  },
  // {
  //   startYear: 1928,
  //   endYear: 1929,
  //   description: "VOTING RIGHTS"
  // },
  {
    startYear: 1939,
    endYear: 1945,
    description: "WW2",
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
    id: "edinburgh-forty-home",
    year: 1870,
    coordinates: [55.942668948406876, -3.1868325772638566],
    alt: "15 Buccleuch Place\nSophia Jex-Blake, leader of the lady students,\nIsabel Thorne, and Matilda Chaplin lived here\n from 1869 to 1872",
  },
  {
    id: "surgeons-hall",
    year: 1870,
    coordinates: [55.946645682120604, -3.185338751775801],
    alt: "Surgeon's Hall",
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

// Add a credit object for each milestone year that needs map or image credits.
export const creditsByYear = [
  {
    year: 1583,
    map: "Edenburgum Scotiae Metropolis Cologne: G. Braun & F. Hogenberg, ca. 1582",
    image: "",
  },
  {
    year: 1726,
    map: "The plan of the city and castle of Edinburgh anno 1742 / by Willm. Edgar, architect.",
    image: "",
  },
  {
    year: 1809,
    map: "",
    image:
      "Dr James Barry, c. 1820s. Unknown artist. Museum Africa, Johannesburg. Wikimedia Commons. Public domain.",
  },
  {
    year: 1862,
    map: "",
    image:
      "Elizabeth Garrett Anderson. Photograph by Walery, published by Sampson Low & Co. in February 1889",
  },
  {
    year: 1867,
    map: "Plan of Edinburgh & Leith with Suburbs, from Ordnance and Actual Surveys. Constructed for the Post Office Directory. By John Bartholomew, F.R.G.S. 1867 ",
    image:
      "Street elevation from north east showing Mary Erskine School, 1910. Historic Environment Scotland Archives, via Trove.scot, image 2657634.",
  },
  {
    year: 1870,
    map: "Plan of Edinburgh & Leith with Suburbs, from Ordnance and Actual Surveys. Constructed for the Post Office Directory. By John Bartholomew, F.R.G.S. 1875",
    image: "Surgeons' Hall, Edinburgh, c. 1870. The National Archives",
  },
  {
    year: 1875,
    map: "Plan of Edinburgh & Leith with Suburbs, from Ordnance and Actual Surveys. Constructed for the Post Office Directory. By John Bartholomew, F.R.G.S. 1875",
    image:
      "Gayfield House, Edinburgh, Hstoric Environment Scotland, Trove.scot, image 1098306",
  },
  {
    year: 1886,
    map: "Plan of Edinburgh and Leith with Suburbs, from Ordnance and Actual Surveys. Constructed for the Post Office Directory by John Bartholomew. 1888-9",
    image:
      "Kim Traynor, “Chisholm House, Surgeons’ Square,” 23 July 2011, Geograph Britain and Ireland, CC BY-SA 2.0.",
  },
  {
    year: 1889,
    map: "Plan of Edinburgh and Leith with Suburbs, from Ordnance and Actual Surveys. Constructed for the Post Office Directory by John Bartholomew. 1888-9",
    image:
      "General view of Minto House, Chambers Street incorporating Free Tron Church, 1880. Historic Environment Scotland / Canmore, via trove.scot",
  },
];
