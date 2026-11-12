/** 지도 메뉴에 필요한 맵 정보 (world/maps.ts MapDef의 일부) */
export interface MapEntry {
  id: string;
  name: string;
  blurb: string;
}

export interface MapMenuItem extends MapEntry {
  /** 지금 있는 맵 */
  current: boolean;
}

/** 지도 메뉴 목록 (D-58 3단계): 맵 순서대로, 지금 있는 맵에 표시 */
export function mapMenuItems(maps: readonly MapEntry[], currentId: string): MapMenuItem[] {
  return maps.map(({ id, name, blurb }) => ({ id, name, blurb, current: id === currentId }));
}

/** 고른 맵으로 옮겨야 하나: 목록에 있고 지금 맵이 아닐 때만 */
export function shouldSwitch(maps: readonly MapEntry[], currentId: string, pickedId: string): boolean {
  return pickedId !== currentId && maps.some((m) => m.id === pickedId);
}
