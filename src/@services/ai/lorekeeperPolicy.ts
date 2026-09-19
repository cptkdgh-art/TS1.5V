/** 기존 작품의 값이 비어 있어도 기록보관자를 기본 활성화한다. */
export function isLorekeeperEnabled(value: boolean | undefined): boolean {
  return value !== false;
}
