import { useEffect, useState } from 'react';

export type SidebarMode = 'expanded' | 'collapsed' | 'hidden';

const SIDEBAR_MODE_KEY = 'sugbodoc_sidebar_mode';

export function useSidebarMode() {
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('expanded');

  useEffect(() => {
    const savedMode = window.localStorage.getItem(SIDEBAR_MODE_KEY);
    if (savedMode === 'expanded' || savedMode === 'collapsed' || savedMode === 'hidden') {
      setSidebarMode(savedMode);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_MODE_KEY, sidebarMode);
  }, [sidebarMode]);

  return { sidebarMode, setSidebarMode };
}