'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import * as htmlToImage from 'html-to-image';

type CardField = 'title' | 'desc';

type CardItemData = {
  id: number;
  lab: string;
  bgImage: string;
  mainImage: string; // file 업로드 시 dataURL이 들어올 수 있음
  title: string;
  desc: string; // HTML string
  icon: string;
};

type BaseCardProps = {
  item: CardItemData;
  isEditing: boolean;
  onTextChange: (id: number, field: CardField, value: string) => void;
  onImageChange: (file: File | null) => void;
};

type CardItemProps = BaseCardProps & {
  isComposing: boolean;
  setIsComposing: React.Dispatch<React.SetStateAction<boolean>>;
};

type LabGroupProps = {
  title: string;
  labs: string[];
};

const STORAGE_KEYS = {
  intro: 'intro-content-text',
  cards: 'card-content-data-total',
} as const;

// =========================
// WideCard: 2단 저장 구분자
// =========================
const WIDE_SPLIT_MARK = '<!--WIDE_SPLIT-->';

function serializeWideDesc(col1: string, col2: string, isSplit: boolean) {
  const left = col1 ?? '';
  const right = col2 ?? '';
  if (!isSplit) return left;
  return `${left}<br/>${WIDE_SPLIT_MARK}${right}`;
}

function parseWideDesc(desc: string) {
  const raw = desc ?? '';
  const idx = raw.indexOf(WIDE_SPLIT_MARK);
  if (idx === -1) return { col1: raw, col2: '', isSplit: false };

  let left = raw.slice(0, idx);
  const right = raw.slice(idx + WIDE_SPLIT_MARK.length);

  left = left.replace(/<br\s*\/?>\s*$/i, '');
  return { col1: left, col2: right, isSplit: true };
}

// =========================
// BlueBold
// =========================
function applyBlueBoldToggle() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  if (range.collapsed) return;

  const startNode = range.startContainer;
  const startEl =
    startNode.nodeType === Node.ELEMENT_NODE
      ? (startNode as Element)
      : (startNode.parentElement as Element | null);

  const blueSpan = startEl?.closest?.('span[data-bluebold="1"]') as HTMLElement | null;

  if (blueSpan) {
    const parent = blueSpan.parentNode;
    if (!parent) return;

    while (blueSpan.firstChild) parent.insertBefore(blueSpan.firstChild, blueSpan);
    parent.removeChild(blueSpan);

    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.setStart(parent, Math.min(parent.childNodes.length, 0));
    sel.addRange(newRange);
    return;
  }

  const span = document.createElement('span');
  span.setAttribute('data-bluebold', '1');
  span.style.fontWeight = '700';
  span.style.color = 'var(--main-blue)';

  span.appendChild(range.extractContents());
  range.insertNode(span);

  sel.removeAllRanges();
  const newRange = document.createRange();
  newRange.setStartAfter(span);
  sel.addRange(newRange);
}

// =========================
// List
// =========================
function toggleBulletPoint() {
  document.execCommand('insertUnorderedList', false);
}

const INITIAL_CARDS: CardItemData[] = [
  {
    id: 1,
    lab: "양산부산대학교병원",
    bgImage: "lab-bg_1-01.svg",
    mainImage: "default.png",
    title: "소제목",
    desc: "내용을 입력하세요.",
    icon: "Zigzag.png"
  },
  {
    id: 2,
    lab: "뉴로메카",
    bgImage: "lab-bg_2-01.svg",
    mainImage: "default.png",
    title: "소제목",
    desc: "내용을 입력하세요.",
    icon: "Flower.png"
  },
  {
    id: 3,
    lab: "부산대 응용로봇연구실",
    bgImage: "lab-bg_2-02.svg",
    mainImage: "default.png",
    title: "소제목",
    desc: "내용을 입력하세요.",
    icon: "Peanut.png"
  },
  {
    id: 4,
    lab: "부산대 인터랙티브로보틱스연구실",
    bgImage: "lab-bg_2-03.svg",
    mainImage: "default.png",
    title: "소제목",
    desc: "내용을 입력하세요.",
    icon: "Diagonal.png"
  },
  {
    id: 5,
    lab: "KAIST 지능형로봇시스템연구실",
    bgImage: "lab-bg_2-04.svg",
    mainImage: "default.png",
    title: "소제목",
    desc: "내용을 입력하세요.",
    icon: "Zigzag.png"
  },
  {
    id: 6,
    lab: "부산대 시각지능및인지연구실",
    bgImage: "lab-bg_3-01.svg",
    mainImage: "default.png",
    title: "소제목",
    desc: "내용을 입력하세요.",
    icon: "Flower.png"
  },
  {
    id: 7,
    lab: "부산대 컴퓨터비전연구실",
    bgImage: "lab-bg_3-02.svg",
    mainImage: "default.png",
    title: "소제목",
    desc: "내용을 입력하세요.",
    icon: "Peanut.png"
  },
  {
    id: 8,
    lab: "퍼즐에이아이",
    bgImage: "lab-bg_3-03.svg",
    mainImage: "default.png",
    title: "소제목",
    desc: "내용을 입력하세요.",
    icon: "Diagonal.png"
  },
  {
    id: 9,
    lab: "한국전자통신연구원",
    bgImage: "lab-bg_3-04.svg",
    mainImage: "default.png",
    title: "소제목",
    desc: "내용을 입력하세요.",
    icon: "Zigzag.png"
  },
];

function resolveImageSrc(src: string) {
  return src.startsWith('data:') ? src : `/images/${src}`;
}

export default function Home() {
  const [introText, setIntroText] = useState('여기에 내용을 입력하세요.');
  const [cardData, setCardData] = useState<CardItemData[]>(INITIAL_CARDS);
  const [isEditing, setIsEditing] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [editorName, setEditorName] = useState('');
  const [isComposing, setIsComposing] = useState(false);

  const wideFlushRef = useRef<null | (() => string)>(null);

  useEffect(() => {
    setMounted(true);

    (async () => {
      const { data: meta, error: metaError } = await supabase
        .from('newsletter_meta')
        .select('intro_text')
        .eq('id', 1)
        .single();

      if (metaError) {
        console.error('intro load error:', metaError);
      } else if (meta?.intro_text) {
        setIntroText(meta.intro_text);
      }

      const { data: rows, error: cardError } = await supabase
        .from('institution_content')
        .select('institution_id, title, content, main_image')
        .order('institution_id', { ascending: true });

      if (cardError) {
        console.error('card load error:', cardError);
        return;
      }

      if (Array.isArray(rows)) {
        setCardData((prev) =>
          prev.map((base) => {
            const row = rows.find((r) => r.institution_id === base.id);
            if (!row) return base;

            return {
              ...base,
              title: row.title ?? base.title,
              desc: row.content ?? base.desc,
              mainImage: row.main_image ?? base.mainImage,
            };
          }),
        );
      }
    })();
  }, []);

  const handleExport = async () => {
    const pages = document.querySelectorAll('.pageSection');

    for (let i = 0; i < pages.length; i++) {
      const node = pages[i] as HTMLElement;

      try {
        const dataUrl = await htmlToImage.toPng(node, {
          pixelRatio: 2,
          backgroundColor: '#ffffff',
        });

        const link = document.createElement('a');
        link.download = `newsletter_page_${i + 1}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('export failed:', err);
        alert(`페이지 ${i + 1} 출력 실패`);
        return;
      }
    }
  };

  const handleTextChange = (id: number, field: CardField, value: string) => {
    setCardData((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleImageChange = (id: number, file: File | null) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setCardData((prev) => prev.map((item) => (item.id === id ? { ...item, mainImage: dataUrl } : item)));
    };
    reader.readAsDataURL(file);
  };

  const { wideCard, page2, page3 } = useMemo(() => {
    return {
      wideCard: cardData[0],
      page2: cardData.slice(1, 5),
      page3: cardData.slice(5, 9),
    };
  }, [cardData]);

  const handleSave = async () => {
    // ✅ (권장) 포커스 해제로 IME/입력 반영 안정화
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const wideDesc = wideFlushRef.current?.() ?? null;
    const wideId = wideCard?.id;

    // ✅ 저장 직후 화면 반영을 위해 state도 확정
    const nextCardData = cardData.map((c) =>
      c.id === wideId && wideDesc != null ? { ...c, desc: wideDesc } : c,
    );
    setCardData(nextCardData);

    const editedBy = editorName.trim() ? editorName.trim() : null;

    const { error: metaError } = await supabase
      .from('newsletter_meta')
      .upsert(
        {
          id: 1,
          intro_text: introText,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

    if (metaError) {
      console.error('meta upsert error:', metaError);
      alert('인트로 저장 실패');
      return;
    }

    const updates = nextCardData.map((c) => ({
      institution_id: c.id,
      title: c.title,
      content: c.desc,
      main_image: c.mainImage,
      updated_at: new Date().toISOString(),
    }));

    const { error: cardError } = await supabase
      .from('institution_content')
      .upsert(updates, { onConflict: 'institution_id' });

    if (cardError) {
      console.error('card upsert error:', cardError);
      alert('카드 저장 실패');
      return;
    }

    setIsEditing(false);
    alert('저장되었습니다.');
  };

  if (!mounted) return null;

  return (
    <main className={`min-h-screen bg-slate-900 flex flex-col items-center ${isEditing ? 'isEditing' : ''}`}>
      <div className="editControlBar">
        <button onClick={handleExport} className="editBtn editBtn--gray">
          <span className="editBtn__icon">🖨️</span>
          출력하기
        </button>

        {!isEditing ? (
          <button onClick={() => setIsEditing(true)} className="editBtn editBtn--blue">
            <span className="editBtn__icon">✏️</span>
            수정하기
          </button>
        ) : (
          <button onClick={handleSave} className="editBtn editBtn--green">
            <span className="editBtn__icon">✅</span>
            저장하기
          </button>
        )}
      </div>

      {/* 1p */}
      <section className="pageSection">
        <div className="figmaCanvas figmaCanvas--intro shadow-2xl" data-content="Subproject1">
          <div className="intro__label">
            <div className="intro__badge intro__badge--small">한국형 ARPA-H 프로젝트 필수의료 임무 과제</div>
            <div className="intro__badge intro__badge--big">SARAM-H 연구단 News Letter</div>
          </div>

          <div className="intro__version">VOL.1</div>

          <div className="intro__host">주관 양산부산대학교병원</div>
          <div className="intro__host2">(연구개발기관)</div>

          <div className="intro__robotImage">
            <img src="/images/introRobot.png" alt="robot illustration" />
          </div>

          <div className="intro__panel">
            <div className="intro__textBox">
              {isEditing ? (
                <textarea
                  className="intro__text editableTextarea"
                  value={introText}
                  onChange={(e) => setIntroText(e.target.value)}
                  placeholder="내용을 입력하세요."
                />
              ) : (
                <p className="intro__textDisplay">{introText}</p>
              )}
            </div>

            <div className="intro__labOverview">
              <LabGroup title="Subproject1" labs={['양산부산대학교병원', '분당서울대학교병원', '경상국립대학교병원']} />
              <LabGroup
                title="Subproject2"
                labs={['뉴로메카', '부산대 응용로봇연구실', '부산대 인터랙티브로보틱스연구실', 'KAIST 지능형로봇시스템연구실']}
              />
              <LabGroup title="Subproject3" labs={['부산대 시각지능및인지연구실', '부산대 컴퓨터비전연구실', '퍼즐에이아이', '한국전자통신연구원']} />
            </div>
          </div>

          <div className="intro__wideCardPos">
            <WideCardItem
              item={wideCard}
              isEditing={isEditing}
              onTextChange={handleTextChange}
              onImageChange={(file: File | null) => handleImageChange(wideCard.id, file)}
              isComposing={isComposing}
              setIsComposing={setIsComposing}
              registerFlush={(fn) => {
                wideFlushRef.current = fn;
              }}
            />
          </div>
        </div>
      </section>

      {/* 2p */}
      <section className="pageSection">
        <div className="figmaCanvas shadow-2xl" data-content="Subproject2">
          <div className="cardGrid">
            {page2.map((item) => (
              <CardItem
                key={item.id}
                item={item}
                isEditing={isEditing}
                onTextChange={handleTextChange}
                onImageChange={(file: File | null) => handleImageChange(item.id, file)}
                isComposing={isComposing}
                setIsComposing={setIsComposing}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 3p */}
      <section className="pageSection">
        <div className="figmaCanvas shadow-2xl" data-content="Subproject3">
          <div className="cardGrid">
            {page3.map((item) => (
              <CardItem
                key={item.id}
                item={item}
                isEditing={isEditing}
                onTextChange={handleTextChange}
                onImageChange={(file: File | null) => handleImageChange(item.id, file)}
                isComposing={isComposing}
                setIsComposing={setIsComposing}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

/* =========================
   Components
========================= */

function LabGroup({ title, labs }: LabGroupProps) {
  return (
    <div className="intro__labGroup">
      <div className="intro__labTitle">{title}</div>
      <div className="intro__labList">
        {labs.map((lab) => (
          <span key={lab} className="intro__labPill">
            {lab}
          </span>
        ))}
      </div>
    </div>
  );
}

function ImageEditButton({ isEditing, onFile }: { isEditing: boolean; onFile: (file: File | null) => void }) {
  if (!isEditing) return null;

  return (
    <label className="imageEditBtn">
      <span className="imageEditBtn__icon">📷</span>
      <span className="imageEditBtn__text">편집</span>
      <input
        type="file"
        className="imageEditBtn__input"
        accept="image/*"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

type WideCardItemProps = CardItemProps & {
  registerFlush?: (fn: () => string) => void;
};

function WideCardItem({
  item,
  isEditing,
  onTextChange,
  onImageChange,
  registerFlush,
}: WideCardItemProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  const [isColumnMode, setIsColumnMode] = useState(false);
  const modeRef = useRef(false);

  const editorRef1 = useRef<HTMLDivElement>(null);
  const editorRef2 = useRef<HTMLDivElement>(null);

  const draftRef = useRef<{ col1: string; col2: string }>({ col1: '', col2: '' });

  useEffect(() => {
    modeRef.current = isColumnMode;
  }, [isColumnMode]);

  useEffect(() => {
    if (isEditing) return;
    draftRef.current = { col1: '', col2: '' };
    setIsColumnMode(false);
    modeRef.current = false;
  }, [isEditing]);

  // ✅ 편집 진입 시: DB desc 파싱해서 2단 복원
  useEffect(() => {
    if (!isEditing) return;

    if (!draftRef.current.col1 && !draftRef.current.col2) {
      const parsed = parseWideDesc(item.desc || '');
      draftRef.current.col1 = parsed.col1 || '';
      draftRef.current.col2 = parsed.col2 || '';
      setIsColumnMode(parsed.isSplit);
      modeRef.current = parsed.isSplit;
    }

    if (editorRef1.current) editorRef1.current.innerHTML = draftRef.current.col1;
    if (editorRef2.current) editorRef2.current.innerHTML = draftRef.current.col2;
  }, [isEditing, item.desc]);

  // ✅ 모드 토글/복원 시: draft → DOM
  useEffect(() => {
    if (!isEditing) return;
    if (editorRef1.current) editorRef1.current.innerHTML = draftRef.current.col1;
    if (isColumnMode && editorRef2.current) editorRef2.current.innerHTML = draftRef.current.col2;
  }, [isEditing, isColumnMode]);

  // ✅ 저장 직전 flush: DOM 직접 읽기
  const flushToSaveString = () => {
    const root = rootRef.current;
    const col1El = root?.querySelector('[data-wide-col="1"]') as HTMLElement | null;
    const col2El = root?.querySelector('[data-wide-col="2"]') as HTMLElement | null;

    const col1 = col1El?.innerHTML ?? '';
    const col2 = col2El?.innerHTML ?? '';

    draftRef.current.col1 = col1;
    draftRef.current.col2 = col2;

    return serializeWideDesc(col1, col2, modeRef.current);
  };

  useEffect(() => {
    if (!registerFlush) return;
    registerFlush(flushToSaveString);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerFlush]);

  const handleToggleColumn = () => {
    if (!isEditing) return;

    const root = rootRef.current;
    const col1El = root?.querySelector('[data-wide-col="1"]') as HTMLElement | null;
    const col2El = root?.querySelector('[data-wide-col="2"]') as HTMLElement | null;

    draftRef.current.col1 = col1El?.innerHTML ?? draftRef.current.col1;
    draftRef.current.col2 = col2El?.innerHTML ?? draftRef.current.col2;

    if (isColumnMode) {
      const combined =
        draftRef.current.col1 + (draftRef.current.col2 ? `<br/>${draftRef.current.col2}` : '');
      draftRef.current.col1 = combined;
      draftRef.current.col2 = '';

      onTextChange(item.id, 'desc', combined);

      requestAnimationFrame(() => {
        if (editorRef1.current) editorRef1.current.innerHTML = combined;
      });
    }

    setIsColumnMode((prev) => {
      const next = !prev;
      modeRef.current = next;
      return next;
    });
  };

  const applyCommand = (commandFn: () => void) => {
    commandFn();
    requestAnimationFrame(() => {
      if (editorRef1.current) draftRef.current.col1 = editorRef1.current.innerHTML;
      if (editorRef2.current) draftRef.current.col2 = editorRef2.current.innerHTML;

      if (!modeRef.current && editorRef1.current) {
        onTextChange(item.id, 'desc', editorRef1.current.innerHTML);
      }
    });
  };

  // ✅ 읽기 모드: split 마크가 있으면 2단 레이아웃으로 렌더링
  const readParsed = useMemo(() => parseWideDesc(item.desc || ''), [item.desc]);

  return (
    <div ref={rootRef} className="card card--wide">
      <div className="card__top">
        <div className="card__labHeader" style={{ backgroundImage: `url('/images/${item.bgImage}')` }}>
          <span className="card__labBadge">{item.lab}</span>
        </div>

        <div className="card__imageWrap card__imageWrap--wide group">
          <img src={resolveImageSrc(item.mainImage)} alt={item.lab} className="card__image" />
          <div className="card__imageEditWrap">
            <ImageEditButton isEditing={isEditing} onFile={onImageChange} />
          </div>
        </div>
      </div>

      <div className="card__bottom card__bottom--wide">
        <div className="card__bottomInner">
          {isEditing ? (
            <textarea
              className="card__title editableTextarea"
              value={item.title}
              rows={2}
              onChange={(e) => onTextChange(item.id, 'title', e.target.value)}
            />
          ) : (
            <h3 className="card__title">{item.title}</h3>
          )}

          <div className="wideBody">
            <div className="card__actionSlot">
              {isEditing ? (
                <div className="richEditor__toolbar">
                  <button
                    type="button"
                    className="richEditor__btn"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyCommand(toggleBulletPoint);
                    }}
                  >
                    List
                  </button>

                  <button
                    type="button"
                    className="richEditor__btn"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyCommand(applyBlueBoldToggle);
                    }}
                  >
                    Bold
                  </button>

                  <button
                    type="button"
                    className={`richEditor__btn ${isColumnMode ? 'active' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleToggleColumn();
                    }}
                  >
                    {isColumnMode ? '1단' : '2단'}
                  </button>
                </div>
              ) : (
                <div className="card__iconBox card__iconBox--wide">
                  <img src={`/icons/${item.icon}`} alt="icon" className="card__icon card__icon--wide" />
                </div>
              )}
            </div>

            {/* ====== Editor or Read ====== */}
            {isEditing ? (
              <div className={`wide-editor-container ${isColumnMode ? 'split-view' : ''}`}>
                <div className="editor-wrapper">
                  <div
                    ref={editorRef1}
                    data-wide-col="1"
                    className="richEditor__content"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => {
                      draftRef.current.col1 = e.currentTarget.innerHTML;
                      if (!modeRef.current) onTextChange(item.id, 'desc', e.currentTarget.innerHTML);
                    }}
                  />
                </div>

                {isColumnMode && (
                  <div className="editor-wrapper">
                    <div
                      ref={editorRef2}
                      data-wide-col="2"
                      className="richEditor__content"
                      contentEditable
                      suppressContentEditableWarning
                      onInput={(e) => {
                        draftRef.current.col2 = e.currentTarget.innerHTML;
                      }}
                    />
                  </div>
                )}
              </div>
            ) : readParsed.isSplit ? (
              // ✅ 읽기 모드 2단 렌더링
              <div className="wide-read-container split-view">
                <div className="wide-read-col wide-read-col--left">
                  <div className="card__desc" dangerouslySetInnerHTML={{ __html: readParsed.col1 }} />
                </div>
                <div className="wide-read-col wide-read-col--right">
                  <div className="card__desc" dangerouslySetInnerHTML={{ __html: readParsed.col2 }} />
                </div>
              </div>
            ) : (
              // ✅ 읽기 모드 1단 렌더링
              <div className="card__desc" dangerouslySetInnerHTML={{ __html: item.desc }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CardItem({
  item,
  isEditing,
  onTextChange,
  onImageChange,
  isComposing,
  setIsComposing,
}: CardItemProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && editorRef.current && editorRef.current.innerHTML !== item.desc) {
      editorRef.current.innerHTML = item.desc;
    }
  }, [isEditing, item.desc]);

  return (
    <div className="card">
      <div className="card__top">
        <div className="card__labHeader" style={{ backgroundImage: `url('/images/${item.bgImage}')` }}>
          <span className="card__labBadge">{item.lab}</span>
        </div>

        <div className="card__imageWrap group">
          <img src={resolveImageSrc(item.mainImage)} alt={item.lab} className="card__image" />
          <div className="card__imageEditWrap">
            <ImageEditButton isEditing={isEditing} onFile={onImageChange} />
          </div>
        </div>
      </div>

      <div className="card__bottom">
        {isEditing ? (
          <textarea
            className="card__title editableTextarea"
            value={item.title}
            rows={2}
            onChange={(e) => onTextChange(item.id, 'title', e.target.value)}
          />
        ) : (
          <h3 className="card__title">{item.title}</h3>
        )}

        <div className="card__spacer" />

        <div className="card__actionSlot">
          {isEditing ? (
            <div className="richEditor__toolbar">
              <button
                type="button"
                className="richEditor__btn"
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggleBulletPoint();
                  requestAnimationFrame(() => {
                    if (editorRef.current) onTextChange(item.id, 'desc', editorRef.current.innerHTML);
                  });
                }}
              >
                List
              </button>

              <button
                type="button"
                className="richEditor__btn"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyBlueBoldToggle();
                  requestAnimationFrame(() => {
                    if (editorRef.current) onTextChange(item.id, 'desc', editorRef.current.innerHTML);
                  });
                }}
              >
                Bold
              </button>
            </div>
          ) : (
            <div className="card__iconBox">
              <img src={`/icons/${item.icon}`} alt="icon" className="card__icon" />
            </div>
          )}
        </div>

        {isEditing ? (
          <div
            ref={editorRef}
            className="card__content richEditor__content"
            contentEditable
            suppressContentEditableWarning
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={(e) => {
              setIsComposing(false);
              onTextChange(item.id, 'desc', e.currentTarget.innerHTML);
            }}
            onInput={(e) => {
              if (isComposing) return;
              onTextChange(item.id, 'desc', e.currentTarget.innerHTML);
            }}
          />
        ) : (
          <div className="card__desc" dangerouslySetInnerHTML={{ __html: item.desc }} />
        )}
      </div>
    </div>
  );
}