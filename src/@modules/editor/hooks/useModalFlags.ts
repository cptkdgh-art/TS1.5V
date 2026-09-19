import { useBooleanFlags } from './useBooleanFlags';

export interface ModalFlags {
  character: boolean;
  cover: boolean;
  createAuthor: boolean;
  readingRoom: boolean;
  episodeArc: boolean;
  briefingRoom: boolean;
  summary: boolean;
  characterGenerate: boolean;
  aspectGenerate: boolean;
  snapshot: boolean;
}

const INITIAL: ModalFlags = {
  character: false,
  cover: false,
  createAuthor: false,
  readingRoom: false,
  episodeArc: false,
  briefingRoom: false,
  summary: false,
  characterGenerate: false,
  aspectGenerate: false,
  snapshot: false,
};

/** 에디터의 boolean 모달 open/close 플래그 10개 (data-bearing 모달은 별도 관리) */
export function useModalFlags() {
  const [modal, setModal] = useBooleanFlags(INITIAL);
  return { modal, setModal };
}
