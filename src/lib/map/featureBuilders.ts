import { timelineImageMarkers } from "../data/timeline";

// Raw data from JSON/CSV loaders is intentionally typed defensively here.
// These conversion helpers validate coordinates before Mapbox draws anything.
type StudentGeoDatum = {
  source_data?: {
    entry_year?: number | string;
    name?: string;
    lat?: number | string;
    lon?: number | string;
    university_address?: {
      original_name?: string;
      lat?: number | string;
      lon?: number | string;
    };
  };
};

type WomenDoctorDatum = {
  name?: {
    original?: string;
  };
  source_data?: {
    "First Qual"?: number | string | null;
    "Year of student registration"?: number | string | null;
    name?: string;
    birthplace?: {
      country?: string | null;
      country_code?: string | null;
      lat?: number | string | null;
      lon?: number | string | null;
      original_name?: string | null;
      place_name?: string | null;
    } | null;
  };
};

type WomenCareer1915Datum = {
  name?: {
    original?: string;
  };
  source_data?: {
    "First Qual"?: number | string | null;
    "Year of student registration"?: number | string | null;
    name?: string;
    career_location_1915?: {
      year?: number | string | null;
      country?: string | null;
      country_code?: string | null;
      lat?: number | string | null;
      location?: string | null;
      lon?: number | string | null;
      original_name?: string | null;
      place_name?: string | null;
      region?: string | null;
    } | null;
    forename?: string | null;
    surname?: string | null;
    Specialism?: string | null;
    "Position 1915"?: string | null;
    "Position codes"?: string | null;
  };
};

type EdinburghSevenDatum = {
  name?: string;
  birthplace?: string;
  lat?: number | string;
  lon?: number | string;
  nationality?: string;
  Collection?: string;
  entry_year?: number | string;
  Life?: string;
  img?: string;
};

export const normalizeWomenCareer1915Region = (region: unknown) => {
  const normalizedRegion = String(region ?? "").trim().toLowerCase();

  if (["ireland", "scotland"].includes(normalizedRegion)) {
    return "Ireland/Scotland";
  }

  if (["england", "wales", "london"].includes(normalizedRegion)) {
    return "England/Wales";
  }

  if (["australia", "new zealand"].includes(normalizedRegion)) {
    return "Australia/New Zealand";
  }

  if (["ceylon", "india", "burma"].includes(normalizedRegion)) {
    return "South Asia";
  }

  if (normalizedRegion === "china") {
    return "China";
  }

  return "Other";
};

export const getStudentPointFeatures = (
  rawData: unknown,
): GeoJSON.Feature<GeoJSON.Point>[] => {
  if (!Array.isArray(rawData)) {
    return [];
  }

  return (rawData as StudentGeoDatum[]).flatMap((row) => {
    const sourceData = row.source_data;
    const universityAddress = sourceData?.university_address;
    const directLat = Number(sourceData?.lat);
    const directLon = Number(sourceData?.lon);
    const addressLat = Number(universityAddress?.lat);
    const addressLon = Number(universityAddress?.lon);
    const lat = Number.isFinite(directLat) ? directLat : addressLat;
    const lon = Number.isFinite(directLon) ? directLon : addressLon;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return [];
    }

    const feature: GeoJSON.Feature<GeoJSON.Point> = {
      type: "Feature",
      properties: {
        name: sourceData?.name ?? "Unknown",
        entry_year: sourceData?.entry_year ?? null,
        address: universityAddress?.original_name ?? "",
      },
      geometry: {
        type: "Point",
        coordinates: [lon, lat],
      },
    };

    return [feature];
  });
};

export const getEdinburghSevenPointFeatures = (
  rawData: unknown,
): GeoJSON.Feature<GeoJSON.Point>[] => {
  if (!Array.isArray(rawData)) {
    return [];
  }

  return (rawData as EdinburghSevenDatum[]).flatMap((row) => {
    const lat = Number(row.lat);
    const lon = Number(row.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return [];
    }

    const feature: GeoJSON.Feature<GeoJSON.Point> = {
      type: "Feature",
      properties: {
        name: row.name ?? "Unknown",
        birthplace: row.birthplace ?? "",
        entry_year: row.entry_year ?? null,
        life: row.Life ?? "",
        img: row.img ?? "",
      },
      geometry: {
        type: "Point",
        coordinates: [lon, lat],
      },
    };

    return [feature];
  });
};

export const getWomenDoctorBirthplaceFeatures = (
  rawData: unknown,
): GeoJSON.Feature<GeoJSON.Point>[] => {
  if (!Array.isArray(rawData)) {
    return [];
  }

  return (rawData as WomenDoctorDatum[]).flatMap((row) => {
    const sourceData = row.source_data;
    const birthplace = sourceData?.birthplace;
    const lat = Number(birthplace?.lat);
    const lon = Number(birthplace?.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return [];
    }

    const feature: GeoJSON.Feature<GeoJSON.Point> = {
      type: "Feature",
      properties: {
        name: sourceData?.name ?? row.name?.original ?? "Unknown",
        first_qual: sourceData?.["First Qual"] ?? null,
        student_registration:
          sourceData?.["Year of student registration"] ?? null,
        birthplace:
          birthplace?.place_name ?? birthplace?.original_name ?? "Unknown",
        birthplace_original: birthplace?.original_name ?? "",
        country: birthplace?.country ?? "",
        country_code: birthplace?.country_code ?? "",
      },
      geometry: {
        type: "Point",
        coordinates: [lon, lat],
      },
    };

    return [feature];
  });
};

export const getWomenDoctorCareerLocationFeatures = (
  rawData: unknown,
): GeoJSON.Feature<GeoJSON.Point>[] => {
  if (!Array.isArray(rawData)) {
    return [];
  }

  return (rawData as WomenCareer1915Datum[]).flatMap((row) => {
    const sourceData = row.source_data;
    const careerLocation = sourceData?.career_location_1915;
    const lat = Number(careerLocation?.lat);
    const lon = Number(careerLocation?.lon);

    if (!careerLocation || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      return [];
    }

    const feature: GeoJSON.Feature<GeoJSON.Point> = {
      type: "Feature",
      properties: {
        name: sourceData?.name ?? row.name?.original ?? "Unknown",
        first_qual: sourceData?.["First Qual"] ?? null,
        student_registration:
          sourceData?.["Year of student registration"] ?? null,
        career_year: careerLocation.year ?? null,
        career_location:
          careerLocation.place_name ??
          careerLocation.location ??
          careerLocation.original_name ??
          "Unknown",
        career_location_original: careerLocation.original_name ?? "",
        country: careerLocation.country ?? "",
        country_code: careerLocation.country_code ?? "",
        region: normalizeWomenCareer1915Region(careerLocation.region),
        specialism: sourceData?.Specialism ?? "",
        position_1915: sourceData?.["Position 1915"] ?? "",
        position_codes: sourceData?.["Position codes"] ?? "",
      },
      geometry: {
        type: "Point",
        coordinates: [lon, lat],
      },
    };

    return [feature];
  });
};

export const getTimelineMarkerFeatures = (
  year: number,
): GeoJSON.Feature<GeoJSON.Point>[] => {
  const displayYear = Math.floor(year);

  return timelineImageMarkers
    .filter((marker) => marker.year === displayYear)
    .map(({ id, year: markerYear, coordinates, alt }) => {
      const [latitude, longitude] = coordinates;

      return {
        type: "Feature",
        properties: {
          id,
          year: markerYear,
          label: alt,
        },
        geometry: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
      };
    });
};
