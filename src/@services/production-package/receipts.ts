import type {
  ProductionPackage,
  ProductionPackageIdMap,
  ProductionPackageReceipt,
} from '@core/types';
import {
  getRaw,
  getWorkspaceStorageKey,
  setRaw,
  STORAGE_KEYS,
} from '@services/storage';

function identityMap(productionPackage: ProductionPackage): ProductionPackageIdMap {
  const idMap: ProductionPackageIdMap = {
    authors: {}, series: {}, volumes: {}, novels: {}, chapters: {}, characters: {}, foreshadowings: {}, snapshots: {},
  };
  productionPackage.payload.authors.forEach((author) => { idMap.authors[author.id] = author.id; });
  productionPackage.payload.series.forEach((series) => {
    idMap.series[series.id] = series.id;
    series.blueprint?.volumes.forEach((volume) => {
      if (volume.id) idMap.volumes[volume.id] = volume.id;
    });
    series.characters.forEach((character) => { idMap.characters[character.id] = character.id; });
  });
  productionPackage.payload.novels.forEach((novel) => {
    idMap.novels[novel.id] = novel.id;
    novel.chapters.forEach((chapter, index) => {
      const id = chapter.id || `legacy-${index}`;
      idMap.chapters[`${novel.id}:${id}`] = id;
    });
    novel.characters.forEach((character) => { idMap.characters[character.id] = character.id; });
    novel.foreshadowingSystem?.items.forEach((item) => {
      idMap.foreshadowings[`${novel.id}:${item.id}`] = item.id;
    });
    novel.snapshots?.forEach((snapshot) => {
      idMap.snapshots[`${novel.id}:${snapshot.id}`] = snapshot.id;
    });
  });
  return idMap;
}

export async function recordProductionPackageExport(
  workspaceId: string,
  productionPackage: ProductionPackage,
): Promise<ProductionPackageReceipt> {
  const key = getWorkspaceStorageKey(workspaceId, STORAGE_KEYS.PRODUCTION_PACKAGE_RECEIPTS);
  const receipts = await getRaw<ProductionPackageReceipt[]>(key) ?? [];
  const receipt: ProductionPackageReceipt = {
    lineageId: productionPackage.package.lineageId,
    packageId: productionPackage.package.packageId,
    revision: productionPackage.package.revision,
    importedAt: Date.now(),
    targetWorkspaceId: workspaceId,
    mode: 'export',
    idMap: identityMap(productionPackage),
  };
  await setRaw(key, [...receipts.filter((item) => item.packageId !== receipt.packageId), receipt]);
  return receipt;
}
