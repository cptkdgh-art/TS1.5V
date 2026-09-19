import type { ProductionPackageSection, ProductionPackageSectionSelection } from '@core/types';

export const PRODUCTION_PACKAGE_SECTIONS: ProductionPackageSection[] = [
  'authors',
  'workCore',
  'planning',
  'worldbuilding',
  'manuscript',
  'memory',
  'collaboration',
  'assets',
];

export const EMPTY_PACKAGE_SECTIONS: ProductionPackageSectionSelection = {
  authors: false,
  workCore: false,
  planning: false,
  worldbuilding: false,
  manuscript: false,
  memory: false,
  collaboration: false,
  assets: false,
};

export const PLANNING_PACKAGE_SECTIONS: ProductionPackageSectionSelection = {
  ...EMPTY_PACKAGE_SECTIONS,
  authors: true,
  workCore: true,
  planning: true,
  worldbuilding: true,
};

export const COMMISSION_PACKAGE_SECTIONS: ProductionPackageSectionSelection = {
  ...PLANNING_PACKAGE_SECTIONS,
  manuscript: true,
  collaboration: true,
};

export const DELIVERY_PACKAGE_SECTIONS: ProductionPackageSectionSelection = {
  authors: true,
  workCore: true,
  planning: true,
  worldbuilding: true,
  manuscript: true,
  memory: true,
  collaboration: true,
  assets: true,
};
