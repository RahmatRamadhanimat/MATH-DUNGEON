export type MazeBiomeId =
  | 'stone_dungeon'
  | 'crystal_forest'
  | 'desert_temple'
  | 'ice_fortress';

export const DEFAULT_MAZE_BIOME: MazeBiomeId = 'stone_dungeon';

export interface BiomeTilePalette {
  // Corridor floor flagstones
  floorMortar: string;
  floorSlabA: string;
  floorSlabB: string;
  floorSlabC: string;
  floorSlabD: string;
  floorBevelLight: string;
  floorBevelLightAlt: string;
  floorBevelShadow: string;
  floorDetailDark: string;
  floorAccent1: string;
  floorAccent2: string;

  // Secret chamber / sanctum floor
  secretOuter: string;
  secretFrameMid: string;
  secretFrameLight: string;
  secretCarpetEven: string;
  secretCarpetOdd: string;
  secretInnerEven: string;
  secretInnerOdd: string;
  secretTrimLight: string;
  secretTrimDark: string;
  secretStud: string;
  secretMotif: string;
  secretCenterGem: string;

  // 2.5D Wall masonry
  wallMortar: string;
  wallCorniceTop: string;
  wallCorniceBody: string;
  wallCorniceHighlight: string;
  wallCorniceShadow: string;
  wallUpperA: string;
  wallUpperB: string;
  wallUpperHiA: string;
  wallUpperHiB: string;
  wallMidA: string;
  wallMidB: string;
  wallMidHi: string;
  wallPlinthA: string;
  wallPlinthB: string;
  wallPlinthHi: string;
  wallGroundShadow: string;
  wallOrnamentDark: string;
  wallOrnamentMid: string;
  wallOrnamentBright: string;

  // Wall sconce / lantern / brazier light source
  sconceDark: string;
  sconceBody: string;
  sconceBracketDark: string;
  sconceBracketBright: string;
  flameOuter: string;
  flameMid: string;
  flameInner: string;
  flameCore: string;
  spark1: string;
  spark2: string;

  // Doorway archway
  doorDark: string;
  doorMid: string;
  doorLight: string;
  doorLintelDark: string;
  doorLintelMid: string;
  doorStud: string;
  doorThresholdDark: string;
  doorThresholdLight: string;

  // Crystal decor accent
  crystalBaseDark: string;
  crystalBaseLight: string;
  crystalSpireDark: string;
  crystalMainA: string;
  crystalMainB: string;
  crystalBrightA: string;
  crystalBrightB: string;
  crystalSpark: string;
}

export interface BiomeThemeConfig {
  id: MazeBiomeId;
  name: string;
  shortTag: string;
  tagline: string;
  accentHex: string;
  swatchColors: readonly [string, string, string, string];
  voidBgHex: string;
  shadowTintHex: string;
  torchGlowRgbaStart: string;
  torchGlowRgbaEnd: string;
  minimap: {
    backdrop: string;
    unexploredWalkable: string;
    floorVisible: string;
    floorDiscovered: string;
    secretVisible: string;
    secretDiscovered: string;
    wallDiscovered: string;
    roomBorder: string;
  };
  projector: {
    backdrop: string;
    wallBase: string;
    wallHighlight: string;
    torchDot: string;
    floorEven: string;
    floorOdd: string;
    secretEven: string;
    secretOdd: string;
    door: string;
    spawn: string;
    exit: string;
    roomBorder: string;
    roomLabel: string;
    outerBorder: string;
  };
  tiles: BiomeTilePalette;
}

export const MAZE_BIOMES: Record<MazeBiomeId, BiomeThemeConfig> = {
  stone_dungeon: {
    id: 'stone_dungeon',
    name: 'Dungeon Batu',
    shortTag: 'Klasik',
    tagline: 'Benteng batu obor hangat dengan ruang rahasia kerajaan',
    accentHex: '#F59E0B',
    swatchColors: ['#475569', '#212A3A', '#5B234B', '#F59E0B'],
    voidBgHex: '#090D15',
    shadowTintHex: '#05080F',
    torchGlowRgbaStart: 'rgba(251, 191, 36, 0.25)',
    torchGlowRgbaEnd: 'rgba(251, 191, 36, 0)',
    minimap: {
      backdrop: 'rgba(9, 13, 21, 0.48)',
      unexploredWalkable: 'rgba(51, 65, 85, 0.18)',
      floorVisible: 'rgba(125, 211, 252, 0.68)',
      floorDiscovered: 'rgba(56, 189, 248, 0.34)',
      secretVisible: 'rgba(192, 132, 252, 0.88)',
      secretDiscovered: 'rgba(168, 85, 247, 0.56)',
      wallDiscovered: 'rgba(148, 163, 184, 0.44)',
      roomBorder: 'rgba(216, 180, 254, 0.85)',
    },
    projector: {
      backdrop: '#070B14',
      wallBase: '#0F172A',
      wallHighlight: '#253552',
      torchDot: '#F59E0B',
      floorEven: '#1E293B',
      floorOdd: '#1A2436',
      secretEven: '#2E1F4D',
      secretOdd: '#281B43',
      door: '#92400E',
      spawn: '#1E3A5F',
      exit: '#14532D',
      roomBorder: 'rgba(192, 132, 252, 0.55)',
      roomLabel: 'rgba(233, 213, 255, 0.68)',
      outerBorder: 'rgba(56, 189, 248, 0.35)',
    },
    tiles: {
      floorMortar: '#121722',
      floorSlabA: '#212A3A',
      floorSlabB: '#252F42',
      floorSlabC: '#232C3D',
      floorSlabD: '#1E2736',
      floorBevelLight: '#334155',
      floorBevelLightAlt: '#38465B',
      floorBevelShadow: '#161D2A',
      floorDetailDark: '#19202E',
      floorAccent1: '#15803D',
      floorAccent2: '#F59E0B',

      secretOuter: '#1A142B',
      secretFrameMid: '#2B2144',
      secretFrameLight: '#392B58',
      secretCarpetEven: '#4A1D3D',
      secretCarpetOdd: '#3F1D4A',
      secretInnerEven: '#5B234B',
      secretInnerOdd: '#4E235B',
      secretTrimLight: '#D97706',
      secretTrimDark: '#B45309',
      secretStud: '#FACC15',
      secretMotif: '#702A5C',
      secretCenterGem: '#FBBF24',

      wallMortar: '#0B0F17',
      wallCorniceTop: '#64748B',
      wallCorniceBody: '#475569',
      wallCorniceHighlight: '#94A3B8',
      wallCorniceShadow: '#1E293B',
      wallUpperA: '#334155',
      wallUpperB: '#3B495E',
      wallUpperHiA: '#475569',
      wallUpperHiB: '#52637A',
      wallMidA: '#2D3A4D',
      wallMidB: '#283344',
      wallMidHi: '#3E4E66',
      wallPlinthA: '#1E293B',
      wallPlinthB: '#222E42',
      wallPlinthHi: '#334155',
      wallGroundShadow: '#070A10',
      wallOrnamentDark: '#14532D',
      wallOrnamentMid: '#16A34A',
      wallOrnamentBright: '#4ADE80',

      sconceDark: '#0F172A',
      sconceBody: '#334155',
      sconceBracketDark: '#78350F',
      sconceBracketBright: '#F59E0B',
      flameOuter: '#EA580C',
      flameMid: '#F97316',
      flameInner: '#FACC15',
      flameCore: '#FEF08A',
      spark1: '#F97316',
      spark2: '#FACC15',

      doorDark: '#271206',
      doorMid: '#78350F',
      doorLight: '#B45309',
      doorLintelDark: '#451A03',
      doorLintelMid: '#92400E',
      doorStud: '#FACC15',
      doorThresholdDark: '#78350F',
      doorThresholdLight: '#D97706',

      crystalBaseDark: '#0F172A',
      crystalBaseLight: '#334155',
      crystalSpireDark: '#0369A1',
      crystalMainA: '#38BDF8',
      crystalMainB: '#0EA5E9',
      crystalBrightA: '#BAE6FD',
      crystalBrightB: '#7DD3FC',
      crystalSpark: '#E0F2FE',
    },
  },

  crystal_forest: {
    id: 'crystal_forest',
    name: 'Hutan Kristal',
    shortTag: 'Bioluminesen',
    tagline: 'Rimba lumut zamrud berpendar lentera kristal & ametis',
    accentHex: '#2DD4BF',
    swatchColors: ['#1E5B45', '#17332C', '#2E2356', '#2DD4BF'],
    voidBgHex: '#051210',
    shadowTintHex: '#030C0A',
    torchGlowRgbaStart: 'rgba(45, 212, 191, 0.28)',
    torchGlowRgbaEnd: 'rgba(45, 212, 191, 0)',
    minimap: {
      backdrop: 'rgba(5, 18, 16, 0.52)',
      unexploredWalkable: 'rgba(20, 83, 65, 0.22)',
      floorVisible: 'rgba(94, 234, 212, 0.72)',
      floorDiscovered: 'rgba(20, 184, 166, 0.36)',
      secretVisible: 'rgba(217, 70, 239, 0.85)',
      secretDiscovered: 'rgba(168, 85, 247, 0.52)',
      wallDiscovered: 'rgba(52, 211, 153, 0.42)',
      roomBorder: 'rgba(103, 232, 249, 0.85)',
    },
    projector: {
      backdrop: '#051210',
      wallBase: '#0C261E',
      wallHighlight: '#1F5C47',
      torchDot: '#2DD4BF',
      floorEven: '#15342C',
      floorOdd: '#122D26',
      secretEven: '#281F4A',
      secretOdd: '#21193E',
      door: '#14532D',
      spawn: '#11424A',
      exit: '#065F46',
      roomBorder: 'rgba(45, 212, 191, 0.6)',
      roomLabel: 'rgba(153, 246, 228, 0.72)',
      outerBorder: 'rgba(45, 212, 191, 0.42)',
    },
    tiles: {
      floorMortar: '#091815',
      floorSlabA: '#17332C',
      floorSlabB: '#1B3B33',
      floorSlabC: '#16302A',
      floorSlabD: '#132A24',
      floorBevelLight: '#28564B',
      floorBevelLightAlt: '#2E6557',
      floorBevelShadow: '#0D211C',
      floorDetailDark: '#0D1E1A',
      floorAccent1: '#2DD4BF',
      floorAccent2: '#C084FC',

      secretOuter: '#14112B',
      secretFrameMid: '#211C45',
      secretFrameLight: '#2E285E',
      secretCarpetEven: '#1F3A4B',
      secretCarpetOdd: '#262E54',
      secretInnerEven: '#274B5E',
      secretInnerOdd: '#323A69',
      secretTrimLight: '#2DD4BF',
      secretTrimDark: '#0F766E',
      secretStud: '#A5F3FC',
      secretMotif: '#38BDF8',
      secretCenterGem: '#E879F9',

      wallMortar: '#06130F',
      wallCorniceTop: '#34D399',
      wallCorniceBody: '#15803D',
      wallCorniceHighlight: '#6EE7B7',
      wallCorniceShadow: '#0D2E22',
      wallUpperA: '#194534',
      wallUpperB: '#1E523E',
      wallUpperHiA: '#28694F',
      wallUpperHiB: '#2E785B',
      wallMidA: '#163B2D',
      wallMidB: '#133327',
      wallMidHi: '#235944',
      wallPlinthA: '#102A21',
      wallPlinthB: '#133227',
      wallPlinthHi: '#1E4C3B',
      wallGroundShadow: '#040C09',
      wallOrnamentDark: '#6B21A8',
      wallOrnamentMid: '#A855F7',
      wallOrnamentBright: '#E879F9',

      sconceDark: '#0B1D1A',
      sconceBody: '#1F4B43',
      sconceBracketDark: '#0F766E',
      sconceBracketBright: '#2DD4BF',
      flameOuter: '#0891B2',
      flameMid: '#06B6D4',
      flameInner: '#5EEAD4',
      flameCore: '#CCFBF1',
      spark1: '#5EEAD4',
      spark2: '#C084FC',

      doorDark: '#0C2419',
      doorMid: '#166534',
      doorLight: '#22C55E',
      doorLintelDark: '#14532D',
      doorLintelMid: '#15803D',
      doorStud: '#5EEAD4',
      doorThresholdDark: '#0F766E',
      doorThresholdLight: '#2DD4BF',

      crystalBaseDark: '#0A1E1B',
      crystalBaseLight: '#1E4E46',
      crystalSpireDark: '#7E22CE',
      crystalMainA: '#C084FC',
      crystalMainB: '#A855F7',
      crystalBrightA: '#F5D0FE',
      crystalBrightB: '#E9D5FF',
      crystalSpark: '#CCFBF1',
    },
  },

  desert_temple: {
    id: 'desert_temple',
    name: 'Kuil Gurun Pasir',
    shortTag: 'Fajar Gurun',
    tagline: 'Batu pasir ukiran emas, anglo api fajar & ruang lapis lazuli',
    accentHex: '#FBBF24',
    swatchColors: ['#B8864B', '#5A4024', '#1E3A5F', '#FACC15'],
    voidBgHex: '#150E07',
    shadowTintHex: '#0E0804',
    torchGlowRgbaStart: 'rgba(251, 146, 60, 0.30)',
    torchGlowRgbaEnd: 'rgba(251, 146, 60, 0)',
    minimap: {
      backdrop: 'rgba(21, 14, 7, 0.54)',
      unexploredWalkable: 'rgba(120, 82, 42, 0.22)',
      floorVisible: 'rgba(251, 191, 36, 0.72)',
      floorDiscovered: 'rgba(217, 119, 6, 0.40)',
      secretVisible: 'rgba(56, 189, 248, 0.88)',
      secretDiscovered: 'rgba(37, 99, 235, 0.56)',
      wallDiscovered: 'rgba(214, 166, 101, 0.48)',
      roomBorder: 'rgba(250, 204, 21, 0.88)',
    },
    projector: {
      backdrop: '#140D06',
      wallBase: '#3A2512',
      wallHighlight: '#85592B',
      torchDot: '#FDE047',
      floorEven: '#5B4023',
      floorOdd: '#4F371E',
      secretEven: '#1D3A5F',
      secretOdd: '#173050',
      door: '#B45309',
      spawn: '#1E40AF',
      exit: '#15803D',
      roomBorder: 'rgba(250, 204, 21, 0.62)',
      roomLabel: 'rgba(254, 240, 138, 0.78)',
      outerBorder: 'rgba(251, 191, 36, 0.45)',
    },
    tiles: {
      floorMortar: '#2B1B0D',
      floorSlabA: '#5E4225',
      floorSlabB: '#684A29',
      floorSlabC: '#583E22',
      floorSlabD: '#50371E',
      floorBevelLight: '#876238',
      floorBevelLightAlt: '#966E40',
      floorBevelShadow: '#3D2915',
      floorDetailDark: '#3A2714',
      floorAccent1: '#D97706',
      floorAccent2: '#0EA5E9',

      secretOuter: '#101D33',
      secretFrameMid: '#182D4F',
      secretFrameLight: '#213D6B',
      secretCarpetEven: '#1E3A5F',
      secretCarpetOdd: '#1A3354',
      secretInnerEven: '#254A78',
      secretInnerOdd: '#20416B',
      secretTrimLight: '#FACC15',
      secretTrimDark: '#CA8A04',
      secretStud: '#FEF08A',
      secretMotif: '#38BDF8',
      secretCenterGem: '#FACC15',

      wallMortar: '#29180B',
      wallCorniceTop: '#EAB308',
      wallCorniceBody: '#C08B4B',
      wallCorniceHighlight: '#FDE68A',
      wallCorniceShadow: '#4A2F15',
      wallUpperA: '#9A6B3A',
      wallUpperB: '#A87642',
      wallUpperHiA: '#C29055',
      wallUpperHiB: '#D1A064',
      wallMidA: '#855A2F',
      wallMidB: '#7A512A',
      wallMidHi: '#AD7B45',
      wallPlinthA: '#634120',
      wallPlinthB: '#6E4925',
      wallPlinthHi: '#8D6133',
      wallGroundShadow: '#1D1107',
      wallOrnamentDark: '#0369A1',
      wallOrnamentMid: '#0EA5E9',
      wallOrnamentBright: '#FACC15',

      sconceDark: '#2B1608',
      sconceBody: '#78350F',
      sconceBracketDark: '#B45309',
      sconceBracketBright: '#FACC15',
      flameOuter: '#EA580C',
      flameMid: '#FB923C',
      flameInner: '#FDE047',
      flameCore: '#FEF9C3',
      spark1: '#FBBF24',
      spark2: '#FEF08A',

      doorDark: '#381C08',
      doorMid: '#92400E',
      doorLight: '#D97706',
      doorLintelDark: '#78350F',
      doorLintelMid: '#CA8A04',
      doorStud: '#38BDF8',
      doorThresholdDark: '#92400E',
      doorThresholdLight: '#FACC15',

      crystalBaseDark: '#3B230F',
      crystalBaseLight: '#855A2F',
      crystalSpireDark: '#B45309',
      crystalMainA: '#FACC15',
      crystalMainB: '#F59E0B',
      crystalBrightA: '#FEF08A',
      crystalBrightB: '#FDE047',
      crystalSpark: '#FEF9C3',
    },
  },

  ice_fortress: {
    id: 'ice_fortress',
    name: 'Benteng Es',
    shortTag: 'Glasial',
    tagline: 'Dinding kristal es berhias stalaktit & lentera aurora utara',
    accentHex: '#38BDF8',
    swatchColors: ['#5BA4CF', '#203E57', '#26386B', '#7DD3FC'],
    voidBgHex: '#06101B',
    shadowTintHex: '#040A12',
    torchGlowRgbaStart: 'rgba(125, 211, 252, 0.30)',
    torchGlowRgbaEnd: 'rgba(125, 211, 252, 0)',
    minimap: {
      backdrop: 'rgba(6, 16, 27, 0.52)',
      unexploredWalkable: 'rgba(56, 108, 148, 0.22)',
      floorVisible: 'rgba(186, 230, 253, 0.78)',
      floorDiscovered: 'rgba(56, 189, 248, 0.40)',
      secretVisible: 'rgba(129, 140, 248, 0.88)',
      secretDiscovered: 'rgba(99, 102, 241, 0.54)',
      wallDiscovered: 'rgba(147, 197, 253, 0.50)',
      roomBorder: 'rgba(186, 230, 253, 0.88)',
    },
    projector: {
      backdrop: '#06101B',
      wallBase: '#102740',
      wallHighlight: '#3B7CA8',
      torchDot: '#7DD3FC',
      floorEven: '#203E57',
      floorOdd: '#1B364D',
      secretEven: '#243466',
      secretOdd: '#1E2C57',
      door: '#1D4ED8',
      spawn: '#0E7490',
      exit: '#059669',
      roomBorder: 'rgba(125, 211, 252, 0.62)',
      roomLabel: 'rgba(224, 242, 254, 0.78)',
      outerBorder: 'rgba(125, 211, 252, 0.45)',
    },
    tiles: {
      floorMortar: '#0C1E2E',
      floorSlabA: '#203E57',
      floorSlabB: '#264966',
      floorSlabC: '#1D3950',
      floorSlabD: '#1A3348',
      floorBevelLight: '#497CA3',
      floorBevelLightAlt: '#5C93BC',
      floorBevelShadow: '#132738',
      floorDetailDark: '#122434',
      floorAccent1: '#7DD3FC',
      floorAccent2: '#E0F2FE',

      secretOuter: '#111936',
      secretFrameMid: '#1C2A54',
      secretFrameLight: '#283C75',
      secretCarpetEven: '#1E3263',
      secretCarpetOdd: '#242F69',
      secretInnerEven: '#27427D',
      secretInnerOdd: '#2F3D82',
      secretTrimLight: '#7DD3FC',
      secretTrimDark: '#0284C7',
      secretStud: '#E0F2FE',
      secretMotif: '#818CF8',
      secretCenterGem: '#38BDF8',

      wallMortar: '#0A1929',
      wallCorniceTop: '#E0F2FE',
      wallCorniceBody: '#7DD3FC',
      wallCorniceHighlight: '#FFFFFF',
      wallCorniceShadow: '#1E4668',
      wallUpperA: '#336B94',
      wallUpperB: '#3D7BA8',
      wallUpperHiA: '#64A6D1',
      wallUpperHiB: '#7EC0E8',
      wallMidA: '#28577A',
      wallMidB: '#234D6D',
      wallMidHi: '#4C8AB5',
      wallPlinthA: '#1C3F5C',
      wallPlinthB: '#204766',
      wallPlinthHi: '#396E94',
      wallGroundShadow: '#06111C',
      wallOrnamentDark: '#0369A1',
      wallOrnamentMid: '#38BDF8',
      wallOrnamentBright: '#E0F2FE',

      sconceDark: '#0C2136',
      sconceBody: '#2D5F87',
      sconceBracketDark: '#0284C7',
      sconceBracketBright: '#BAE6FD',
      flameOuter: '#0284C7',
      flameMid: '#38BDF8',
      flameInner: '#BAE6FD',
      flameCore: '#FFFFFF',
      spark1: '#7DD3FC',
      spark2: '#E0F2FE',

      doorDark: '#0F2540',
      doorMid: '#1E4F7A',
      doorLight: '#38BDF8',
      doorLintelDark: '#173A5C',
      doorLintelMid: '#2D6B9E',
      doorStud: '#E0F2FE',
      doorThresholdDark: '#1E4F7A',
      doorThresholdLight: '#7DD3FC',

      crystalBaseDark: '#0E2438',
      crystalBaseLight: '#2E628A',
      crystalSpireDark: '#0284C7',
      crystalMainA: '#7DD3FC',
      crystalMainB: '#38BDF8',
      crystalBrightA: '#FFFFFF',
      crystalBrightB: '#E0F2FE',
      crystalSpark: '#FFFFFF',
    },
  },
};

export const MAZE_BIOME_LIST: readonly BiomeThemeConfig[] = [
  MAZE_BIOMES.stone_dungeon,
  MAZE_BIOMES.crystal_forest,
  MAZE_BIOMES.desert_temple,
  MAZE_BIOMES.ice_fortress,
];

export function normalizeMazeBiome(value: unknown): MazeBiomeId {
  if (
    value === 'stone_dungeon' ||
    value === 'crystal_forest' ||
    value === 'desert_temple' ||
    value === 'ice_fortress'
  ) {
    return value;
  }
  return DEFAULT_MAZE_BIOME;
}

export function getMazeBiomeTheme(biome?: MazeBiomeId | string | null): BiomeThemeConfig {
  return MAZE_BIOMES[normalizeMazeBiome(biome)];
}
