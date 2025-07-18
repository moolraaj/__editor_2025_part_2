'use client';

import { API_URL } from '@/utils/constants';
import dynamic from 'next/dynamic'
import { useEffect } from 'react';

const DynmicEditor = dynamic(() => import('../../components/Editor').then(a => a.EditorWithStore), {
  ssr: false,
})


function EditorPage() {
 
 
  return (
    <DynmicEditor />
  );
}

EditorPage.diplsayName = "EditorPage";

export default EditorPage;
