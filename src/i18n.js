// App language: Simplified Chinese (default) or English.
// Text is written inline as L('English', '中文') so each translation sits next to its English.
// Changing the language saves it and remounts the app (see LanguageGate in App.js), so
// call L() while rendering, not at module load, or the text will not switch.
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANG_KEY = 'scantrack:lang';
export const LANGUAGES = [
  { key: 'zh', label: '简体中文' },
  { key: 'en', label: 'English' },
];

let lang = 'zh';
let listener = null;

export const getLang = () => lang;
export const isZh = () => lang === 'zh';
export const L = (en, zh) => (lang === 'zh' ? zh : en);

export function setLanguage(next) {
  if (next === lang) return;
  lang = next;
  AsyncStorage.setItem(LANG_KEY, next).catch(() => {});
  listener?.(next);
}

// Loads the saved language before the app draws, and remounts everything below when it changes.
export function LanguageGate({ children }) {
  const [current, setCurrent] = useState(null);
  useEffect(() => {
    listener = setCurrent;
    AsyncStorage.getItem(LANG_KEY)
      .catch(() => null)
      .then((saved) => {
        if (saved === 'en' || saved === 'zh') lang = saved;
        setCurrent(lang);
      });
    return () => {
      listener = null;
    };
  }, []);
  if (!current) return null;
  return <React.Fragment key={current}>{children}</React.Fragment>;
}

// ---------- dates ----------
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthShort = (i) => (isZh() ? `${i + 1}月` : MONTHS_EN[i]);
export const monthLong = (i) => (isZh() ? `${i + 1}月` : MONTHS_LONG_EN[i]);

// ---------- built-in category names ----------
// Category keys stay in English (they are saved on receipts, sent to the AI and used in
// exports); only the name shown on screen is translated. User-added categories show as typed.
const CATEGORY_ZH = {
  Purchases: '采购',
  Petrol: '汽油',
  MVRE: '车辆开支',
  'Fixed Assets': '固定资产',
  'Travelling Expenses': '差旅费',
  Salaries: '薪金',
  Drawings: '业主提款',
  Entertainment: '餐饮招待',
  Rental: '租金',
  'HP & Unifi': '电话与网络',
  'General Expenses': '一般开支',
  Others: '其他',
};
export const catLabel = (key) => (isZh() && CATEGORY_ZH[key]) || key;
