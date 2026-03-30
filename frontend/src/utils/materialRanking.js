const DEFAULT_MATERIAL_DB = [
  { name: 'AAC Blocks', cost: 'Low', strength: 'Medium', durability: 'High', bestUse: 'Partition walls' },
  { name: 'Red Brick', cost: 'Medium', strength: 'High', durability: 'Medium', bestUse: 'Load-bearing walls' },
  { name: 'RCC', cost: 'High', strength: 'Very High', durability: 'Very High', bestUse: 'Columns, slabs' },
  { name: 'Steel Frame', cost: 'High', strength: 'Very High', durability: 'Very High', bestUse: 'Long spans (>5m)' },
  { name: 'Hollow Concrete Block', cost: 'Low-Med', strength: 'Medium', durability: 'Medium', bestUse: 'Non-structural walls' },
  { name: 'Fly Ash Brick', cost: 'Low', strength: 'Medium-High', durability: 'High', bestUse: 'General walling' },
  { name: 'Precast Concrete Panel', cost: 'Med-High', strength: 'High', durability: 'Very High', bestUse: 'Structural walls, slabs' },
];

const SCALE = {
  low: 1,
  medium: 2,
  high: 3,
  'very high': 4,
  med: 2,
};

const WALL_TYPES = {
  LOAD_BEARING_WALL: 'LOAD_BEARING_WALL',
  PARTITION_WALL: 'PARTITION_WALL',
};

const DEFAULT_WEIGHTS = {
  strength: 0.5,
  durability: 0.3,
  cost: 0.2,
};

function normalizeToken(token = '') {
  return String(token).trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseQualitativeToNumber(value, fallback = 2) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const raw = normalizeToken(value);
  if (!raw) return fallback;
  if (SCALE[raw] != null) return SCALE[raw];

  // Handles forms like "Low-Med", "Medium-High"
  const parts = raw
    .split(/[-/]/g)
    .map((part) => normalizeToken(part))
    .filter(Boolean)
    .map((part) => SCALE[part])
    .filter((n) => n != null);

  if (!parts.length) return fallback;
  return parts.reduce((sum, n) => sum + n, 0) / parts.length;
}

function isStructuralMaterial(material) {
  const bestUse = normalizeToken(material?.bestUse);
  return /(load-bearing|structural|column|slab|long span|general walling)/.test(bestUse);
}

function isNonStructuralMaterial(material) {
  const bestUse = normalizeToken(material?.bestUse);
  return /(partition|non-structural|general walling)/.test(bestUse);
}

function resolveWallType(wall) {
  const rawType = String(
    wall?.type
      || wall?.element_type
      || (wall?.load_bearing ? WALL_TYPES.LOAD_BEARING_WALL : WALL_TYPES.PARTITION_WALL),
  ).toUpperCase();

  if (rawType.includes('LOAD')) return WALL_TYPES.LOAD_BEARING_WALL;
  if (rawType.includes('PARTITION')) return WALL_TYPES.PARTITION_WALL;
  return WALL_TYPES.PARTITION_WALL;
}

function scoreMaterial(material, weights = DEFAULT_WEIGHTS) {
  const strength = parseQualitativeToNumber(material?.strength, 2);
  const durability = parseQualitativeToNumber(material?.durability, 2);
  const cost = parseQualitativeToNumber(material?.cost, 2);
  const score = (weights.strength * strength) + (weights.durability * durability) - (weights.cost * cost);

  return {
    strength,
    durability,
    cost,
    score,
  };
}

export function rankMaterialsForWall(
  wall,
  {
    materialDb = DEFAULT_MATERIAL_DB,
    weights = DEFAULT_WEIGHTS,
  } = {},
) {
  const type = resolveWallType(wall);
  const wallId = String(wall?.id || wall?.element_id || wall?.wallId || 'WALL_UNKNOWN').toUpperCase();

  const filtered = materialDb.filter((material) => (
    type === WALL_TYPES.LOAD_BEARING_WALL
      ? isStructuralMaterial(material)
      : isNonStructuralMaterial(material)
  ));

  const ranked = filtered
    .map((material) => {
      const scored = scoreMaterial(material, weights);
      return {
        name: material.name,
        score: Number(scored.score.toFixed(3)),
        strength: scored.strength,
        durability: scored.durability,
        cost: scored.cost,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((material, index) => ({
      rank: index + 1,
      ...material,
    }));

  return {
    wallId,
    type,
    materials: ranked,
  };
}

export function rankMaterialsForWalls(walls = [], options = {}) {
  return walls.map((wall) => rankMaterialsForWall(wall, options));
}

export {
  DEFAULT_MATERIAL_DB,
  DEFAULT_WEIGHTS,
  WALL_TYPES,
  parseQualitativeToNumber,
};
