import { create } from 'zustand';
import type { AppView, BasemapId, SidebarFilter } from '../types';

export type ConnectTab = 'sheet' | 'upload' | 'guide';

interface UiState {
  view: AppView;
  selectedId: string | null;
  /** increments whenever the camera should (re)focus the selected hiker */
  focusNonce: number;
  filter: SidebarFilter;
  search: string;
  searchFocusNonce: number;
  terrain3d: boolean;
  basemap: BasemapId;
  measure: boolean;
  showVector: boolean;
  dockOpen: boolean;
  sidebarOpen: boolean;
  scrubIndex: number | null;
  connectOpen: boolean;
  connectTab: ConnectTab;
  pairingId: string | null;

  setView: (v: AppView) => void;
  select: (id: string | null) => void;
  focusHiker: (id: string) => void;
  setFilter: (f: SidebarFilter) => void;
  setSearch: (s: string) => void;
  focusSearch: () => void;
  toggle3d: () => void;
  setBasemap: (b: BasemapId) => void;
  toggleMeasure: () => void;
  toggleVector: () => void;
  toggleDock: () => void;
  setSidebarOpen: (o: boolean) => void;
  setScrub: (i: number | null) => void;
  openConnect: (tab?: ConnectTab) => void;
  closeConnect: () => void;
  openPairing: (id: string) => void;
  closePairing: () => void;
  /** Esc behaviour: closes the top-most layer. Returns true if something was closed. */
  dismiss: () => boolean;
}

export const useUi = create<UiState>((set, get) => ({
  view: 'dashboard',
  selectedId: null,
  focusNonce: 0,
  filter: 'all',
  search: '',
  searchFocusNonce: 0,
  terrain3d: false,
  basemap: 'topo',
  measure: false,
  showVector: true,
  dockOpen: true,
  sidebarOpen: true,
  scrubIndex: null,
  connectOpen: false,
  connectTab: 'sheet',
  pairingId: null,

  setView: (view) => set({ view }),
  select: (selectedId) => set({ selectedId, scrubIndex: null }),
  focusHiker: (id) => set((s) => ({ view: 'dashboard', selectedId: id, scrubIndex: null, focusNonce: s.focusNonce + 1 })),
  setFilter: (filter) => set({ filter }),
  setSearch: (search) => set({ search }),
  focusSearch: () => set((s) => ({ sidebarOpen: true, view: 'dashboard', searchFocusNonce: s.searchFocusNonce + 1 })),
  toggle3d: () => set((s) => ({ terrain3d: !s.terrain3d })),
  setBasemap: (basemap) => set({ basemap }),
  toggleMeasure: () => set((s) => ({ measure: !s.measure })),
  toggleVector: () => set((s) => ({ showVector: !s.showVector })),
  toggleDock: () => set((s) => ({ dockOpen: !s.dockOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setScrub: (scrubIndex) => set({ scrubIndex }),
  openConnect: (tab) => set((s) => ({ connectOpen: true, connectTab: tab ?? s.connectTab })),
  closeConnect: () => set({ connectOpen: false }),
  openPairing: (pairingId) => set({ pairingId }),
  closePairing: () => set({ pairingId: null }),
  dismiss: () => {
    const s = get();
    if (s.pairingId) {
      set({ pairingId: null });
      return true;
    }
    if (s.connectOpen) {
      set({ connectOpen: false });
      return true;
    }
    if (s.measure) {
      set({ measure: false });
      return true;
    }
    if (s.selectedId) {
      set({ selectedId: null, scrubIndex: null });
      return true;
    }
    return false;
  },
}));
