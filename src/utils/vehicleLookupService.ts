/**
 * Vehicle Lookup Service
 * Provides free vehicle information, specifications, model lists, and photos
 * purely using public online APIs (Wikipedia REST API, Wikimedia Commons, NHTSA vPIC).
 * 100% dynamic without hardcoded vehicle records.
 */

export interface VehicleOnlineDetails {
    modelName: string;
    makeName?: string;
    description?: string;
    photoUrl?: string;
    fuelType?: string;
    engineSpecs?: string;
    categorySuggestion?: string;
    yearIntroduced?: number;
    source: 'wikipedia' | 'wikimedia' | 'nhtsa';
}

function extractSpecsFromText(desc: string): {
    fuelType?: string;
    categorySuggestion?: string;
    engineSpecs?: string;
    yearIntroduced?: number;
} {
    if (!desc) return {};

    // Fuel Type detection from article text
    let fuelType: string | undefined = undefined;
    if (/\bcng\b/i.test(desc)) fuelType = "CNG";
    else if (/electric|\bev\b|battery\s*electric/i.test(desc)) fuelType = "Electric";
    else if (/hybrid/i.test(desc)) fuelType = "Hybrid";
    else if (/petrol|gasoline/i.test(desc)) fuelType = "Petrol";
    else if (/diesel/i.test(desc)) fuelType = "Diesel";

    // Category detection from vehicle description
    let categorySuggestion: string | undefined = undefined;
    if (/pickup|ute\b|flatbed/i.test(desc)) categorySuggestion = "Pickup";
    else if (/van\b|minivan|panel\s*van/i.test(desc)) categorySuggestion = "Van";
    else if (/bus\b|minibus|coach/i.test(desc)) categorySuggestion = "Bus";
    else if (/suv\b|utility|mpv|crossover/i.test(desc)) categorySuggestion = "Utility";
    else if (/truck\b|lorry|hauler|tipper/i.test(desc)) categorySuggestion = "Truck";

    // Engine Specs snippet from description
    let engineSpecs: string | undefined = undefined;
    const engineMatch = desc.match(/\b(?:\d+\.?\d*\s*(?:L|litre|cc)|(?:[A-Z0-9-]+\s+turbo(?:charged)?))\b[^,.;]*/i);
    if (engineMatch) {
        engineSpecs = engineMatch[0].trim();
    }

    // Year detection
    let yearIntroduced: number | undefined = undefined;
    const yearMatch = desc.match(/\b(19\d\d|20\d\d)\b/);
    if (yearMatch) {
        yearIntroduced = parseInt(yearMatch[1], 10);
    }

    return { fuelType, categorySuggestion, engineSpecs, yearIntroduced };
}

/**
 * Fetch vehicle photo and summary from Wikipedia's free REST API and Search API
 */
export async function fetchWikipediaVehicleInfo(modelQuery: string): Promise<VehicleOnlineDetails | null> {
    try {
        const cleanQuery = modelQuery.trim();
        if (!cleanQuery) return null;

        // 1. Try direct summary endpoint
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanQuery)}`;
        const res = await fetch(summaryUrl);

        if (res.ok) {
            const data = await res.json();
            if (data.type !== 'disambiguation' && data.title && data.thumbnail?.source) {
                const desc = data.extract || data.description || "";
                const specs = extractSpecsFromText(desc);
                return {
                    modelName: data.title,
                    description: desc,
                    photoUrl: data.thumbnail.source,
                    fuelType: specs.fuelType,
                    categorySuggestion: specs.categorySuggestion,
                    engineSpecs: specs.engineSpecs,
                    yearIntroduced: specs.yearIntroduced,
                    source: 'wikipedia'
                };
            }
        }

        // 2. Direct failed or lacked thumbnail — try Wikipedia Search API with vehicle context
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanQuery + " (automobile OR car OR truck OR vehicle)")}&gsrlimit=4&prop=pageimages|extracts|description&exintro=1&explaintext=1&exchars=350&piprop=thumbnail&pithumbsize=640&format=json&origin=*`;
        const sRes = await fetch(searchUrl);
        if (sRes.ok) {
            const sData = await sRes.json();
            const pages = Object.values(sData.query?.pages || {}) as any[];
            const bestPage = pages.find((p) => p.thumbnail?.source && !p.title.toLowerCase().includes("disambiguation"));
            if (bestPage) {
                const desc = bestPage.extract || bestPage.description || "";
                const specs = extractSpecsFromText(desc);
                return {
                    modelName: bestPage.title,
                    description: desc,
                    photoUrl: bestPage.thumbnail.source,
                    fuelType: specs.fuelType,
                    categorySuggestion: specs.categorySuggestion,
                    engineSpecs: specs.engineSpecs,
                    yearIntroduced: specs.yearIntroduced,
                    source: 'wikipedia'
                };
            }
        }

        // 3. Fallback to Wikimedia Commons image search
        return await fetchWikimediaImage(cleanQuery);
    } catch (err) {
        console.warn("Wikipedia lookup error:", err);
        return null;
    }
}

/**
 * Search Wikimedia Commons for vehicle photos
 */
export async function fetchWikimediaImage(query: string): Promise<VehicleOnlineDetails | null> {
    try {
        const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=6&prop=pageimages|imageinfo&iiprop=url|thumburl&iiurlwidth=640&pithumbsize=640&format=json&origin=*`;
        const res = await fetch(searchUrl);
        if (!res.ok) return null;

        const data = await res.json();
        const pages = Object.values(data.query?.pages || {}) as any[];

        const validPage = pages.find((p) => p.thumbnail?.source || p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url);
        if (validPage) {
            const photo = validPage.thumbnail?.source || validPage.imageinfo?.[0]?.thumburl || validPage.imageinfo?.[0]?.url;
            const specs = extractSpecsFromText(query);
            return {
                modelName: query,
                photoUrl: photo,
                description: `Vehicle media from Wikimedia Commons (${validPage.title})`,
                fuelType: specs.fuelType,
                categorySuggestion: specs.categorySuggestion,
                source: 'wikimedia'
            };
        }
        return null;
    } catch (err) {
        console.warn("Wikimedia search error:", err);
        return null;
    }
}

/**
 * Fetch vehicle models for a make from the free US Government NHTSA vPIC database
 */
export async function fetchNHTSAModels(make: string): Promise<string[]> {
    try {
        if (!make.trim()) return [];
        const url = `https://vpic.nhtsa.dot.gov/api/vehicles/getmodelsformake/${encodeURIComponent(make)}?format=json`;
        const res = await fetch(url);
        if (!res.ok) return [];

        const data = await res.json();
        const results = data.Results || [];
        const uniqueModels = Array.from(new Set(results.map((r: any) => r.Model_Name).filter(Boolean))) as string[];
        return uniqueModels.sort();
    } catch (err) {
        console.warn("NHTSA lookup error:", err);
        return [];
    }
}

/**
 * Comprehensive Dynamic Smart Lookup:
 * Queries Wikipedia REST API with Make + Model, then Model, then Wikimedia Commons
 */
export async function lookupVehicleModelInfo(
    modelName: string,
    makeName?: string
): Promise<VehicleOnlineDetails | null> {
    const query = modelName.trim();
    if (!query) return null;

    // 1. Query Wikipedia with Make + Model if provided
    if (makeName) {
        const fullQuery = `${makeName} ${query}`;
        const wikiWithMake = await fetchWikipediaVehicleInfo(fullQuery);
        if (wikiWithMake && wikiWithMake.photoUrl) {
            return {
                ...wikiWithMake,
                makeName: makeName,
            };
        }
    }

    // 2. Query Wikipedia with Model Name
    const wikiData = await fetchWikipediaVehicleInfo(query);
    if (wikiData && wikiData.photoUrl) {
        return {
            ...wikiData,
            makeName: makeName || wikiData.makeName,
        };
    }

    // 3. Fallback: try Wikimedia Commons image search
    const commonsData = await fetchWikimediaImage(makeName ? `${makeName} ${query}` : query);
    if (commonsData && commonsData.photoUrl) {
        return {
            ...commonsData,
            makeName: makeName,
        };
    }

    // 4. Return whatever Wikipedia found even if photo was absent
    return wikiData || null;
}

/**
 * Convenience helper returning camelCase property names
 */
export async function lookupVehicleInfo(
    makeName?: string,
    modelName?: string
): Promise<{
    imageUrl?: string;
    fuelType?: string;
    engineSpecs?: string;
    description?: string;
    yearIntroduced?: number;
} | null> {
    const res = await lookupVehicleModelInfo(modelName || "", makeName);
    if (!res) return null;
    return {
        imageUrl: res.photoUrl,
        fuelType: res.fuelType,
        engineSpecs: res.engineSpecs,
        description: res.description,
        yearIntroduced: res.yearIntroduced,
    };
}
