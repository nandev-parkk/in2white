/**
 * 목록에서 삭제·복구를 하면 전체 페이지 수가 줄어든다. 마지막 페이지의 유일한 항목을
 * 지우면 그 페이지는 사라지고, 그대로 두면 어드민은 빈 표를 본다. 응답을 받을 때마다
 * 현재 페이지를 유효한 범위로 끌어내린다.
 *
 * `ready`는 placeholder가 아닌 실제 응답을 받았는지다. 이전 페이지의 데이터를 보여주는
 * 동안 끌어내리면 페이지를 넘기는 중에 되돌아간다.
 */
export function clampPage(
  page: number,
  totalPages: number | undefined,
  ready: boolean,
): number {
  if (!ready || totalPages === undefined) return page
  if (page <= 1 || page <= totalPages) return page

  /* 결과가 아예 없으면 1페이지가 빈 목록을 보여주는 자리다. */
  return Math.max(totalPages, 1)
}
