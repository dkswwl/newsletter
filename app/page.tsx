'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabaseClient';


type CardField = 'title' | 'desc';

type CardItemData = {
  id: number;
  lab: string;
  bgImage: string;
  mainImage: string; // file 업로드 시 dataURL이 들어올 수 있음
  title: string;
  desc: string;
  icon: string;
};

type CardComponentProps = {
  item: CardItemData;
  isEditing: boolean;
  onTextChange: (id: number, field: CardField, value: string) => void;
  onImageChange: (file: File | null) => void;
};

type LabGroupProps = {
  title: string;
  labs: string[];
};

const STORAGE_KEYS = {
  intro: 'intro-content-text',
  cards: 'card-content-data-total',
} as const;

const INITIAL_CARDS: CardItemData[] = [
  {
    id: 1,
    lab: "양산부산대학교병원",
    bgImage: "lab-bg_1-01.svg",
    mainImage: "neuromeka.png",
    title: "소제목",
    desc: "내용을 입력하세요.",
    icon: "Zigzag.png"
  },
  {
    id: 2,
    lab: "뉴로메카",
    bgImage: "lab-bg_2-01.svg",
    mainImage: "neuromeka.png",
    title: "소제목",
    desc: "내용을 입력하세요.",
    icon: "Flower.png"
  },
  {
    id: 3,
    lab: "부산대 응용로봇연구실",
    bgImage: "lab-bg_2-02.svg",
    mainImage: "neuromeka.png",
    title: "소제목",
    desc: "내용을 입력하세요.",
    icon: "Peanut.png"
  },
  {
    id: 4,
    lab: "부산대 인터랙티브로보틱스연구실",
    bgImage: "lab-bg_2-03.svg",
    mainImage: "neuromeka.png",
    title: "소제목",
    desc: "내용을 입력하세요.",
    icon: "Diagonal.png"
  },
  {
    id: 5,
    lab: "KAIST 지능형로봇시스템연구실",
    bgImage: "lab-bg_2-04.svg",
    mainImage: "neuromeka.png",
    title: "소제목",
    desc: "내용을 입력하세요.",
    icon: "Zigzag.png"
  },
  {
    id: 6,
    lab: "부산대 시각지능및인지연구실",
    bgImage: "lab-bg_3-01.svg",
    mainImage: "neuromeka.png",
    title: "소제목",
    desc: "내용을 입력하세요.",
    icon: "Flower.png"
  },
  {
    id: 7,
    lab: "부산대 컴퓨터비전연구실",
    bgImage: "lab-bg_3-02.svg",
    mainImage: "neuromeka.png",
    title: "소제목",
    desc: "내용을 입력하세요.",
    icon: "Peanut.png"
  },
  {
    id: 8,
    lab: "퍼즐에이아이",
    bgImage: "lab-bg_3-03.svg",
    mainImage: "neuromeka.png",
    title: "소제목",
    desc: "내용을 입력하세요.",
    icon: "Diagonal.png"
  },
  {
    id: 9,
    lab: "한국전자통신연구원",
    bgImage: "lab-bg_3-04.svg",
    mainImage: "neuromeka.png",
    title: "소제목",
    desc: "내용을 입력하세요.",
    icon: "Zigzag.png"
  },
];


function resolveImageSrc(src: string) {
  return src.startsWith('data:') ? src : `/images/${src}`;
}

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export default function Home() {
  const [introText, setIntroText] = useState('여기에 내용을 입력하세요.');
  const [cardData, setCardData] = useState<CardItemData[]>(INITIAL_CARDS);
  const [isEditing, setIsEditing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    console.log('ENV CHECK', process.env.NEXT_PUBLIC_SUPABASE_URL);

    (async () => {
      // 1) intro 불러오기
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

      // 2) 카드 불러오기
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
              desc: row.content ?? base.desc,       // ✅ UI의 desc ← DB의 content
              mainImage: row.main_image ?? base.mainImage,
            };
          })
        );
      }
    })();
  }, []);


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

  const handleSave = async () => {
    console.log('SAVE CLICKED');
    // 1) intro 저장
    const { error: metaError } = await supabase
      .from('newsletter_meta')
      .upsert(
        {
          id: 1,
          intro_text: introText,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (metaError) {
      console.error(metaError);
      alert('인트로 저장 실패');
      return;
    }

    // 2) 카드 저장: UI의 desc -> DB의 content
    const updates = cardData.map((c) => ({
      institution_id: c.id,
      title: c.title,
      content: c.desc, // ✅ DB 컬럼명이 content
      main_image: c.mainImage,
      updated_at: new Date().toISOString(),
    }));

    const { error: cardError } = await supabase
      .from('institution_content')
      .upsert(updates, { onConflict: 'institution_id' });

    if (cardError) {
      console.error(cardError);
      alert('카드 저장 실패');
      return;
    }

    setIsEditing(false);
    alert('저장되었습니다.');
  };


  const { wideCard, page2, page3 } = useMemo(() => {
    return {
      wideCard: cardData[0],
      page2: cardData.slice(1, 5),
      page3: cardData.slice(5, 9),
    };
  }, [cardData]);

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col items-center">
      {/* 수정/저장 버튼 */}
      <div className="editControlBar">
        {!isEditing ? (
          <button onClick={() => setIsEditing(true)} className="editBtn editBtn--blue">
            <span className="editBtn__icon">✏️</span> 수정하기
          </button>
        ) : (
          <button onClick={handleSave} className="editBtn editBtn--green">
            <span className="editBtn__icon">✅</span> 저장하기
          </button>
        )}
      </div>

      {/* 1p */}
      <section className="pageSection">
        <div className="figmaCanvas figmaCanvas--intro shadow-2xl" data-content="Subproject1">
          <div className="intro__label">
            <div className="intro__badge intro__badge--small">한국형 ARPA-H 프로젝트</div>
            <div className="intro__badge intro__badge--big">SARAM-H 뉴스레터</div>
          </div>

          <div className="intro__version">VOL.1</div>

          <div className="intro__panel">
            <div className="intro__textBox">
              {isEditing ? (
                <textarea
                  className="editableTextarea intro__text"
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

function WideCardItem({ item, isEditing, onTextChange, onImageChange }: CardComponentProps) {
  return (
    <div className="card card--wide">
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
              onChange={(e) => onTextChange(item.id, 'desc', e.target.value)}
            />
          ) : (
            <h3 className="card__title">{item.title}</h3>
          )}

          <div className="card__iconBox card__iconBox--wide">
            <img src={`/icons/${item.icon}`} alt="icon" className="card__icon card__icon--wide" />
          </div>

          {isEditing ? (
            <textarea
              className="card__desc editableTextarea"
              value={item.desc}
              rows={6}
              onChange={(e) => onTextChange(item.id, 'desc', e.target.value)}
            />
          ) : (
            <p className="card__desc">{item.desc}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CardItem({ item, isEditing, onTextChange, onImageChange }: CardComponentProps) {
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
            onChange={(e) => onTextChange(item.id, 'desc', e.target.value)}
          />
        ) : (
          <h3 className="card__title">{item.title}</h3>
        )}

        <div className="card__iconBox">
          <img src={`/icons/${item.icon}`} alt="icon" className="card__icon" />
        </div>

        {isEditing ? (
          <textarea
            className="card__content editableTextarea"
            value={item.desc}
            rows={6}
            onChange={(e) => onTextChange(item.id, 'desc', e.target.value)}
          />
        ) : (
          <p className="card__content">{item.desc}</p>
        )}
      </div>
    </div>
  );
}
