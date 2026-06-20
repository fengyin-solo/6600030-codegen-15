import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { FEAModel, FEAResult } from '../types';
import {
  solve as feaSolve,
  presetCantileverBeam,
  presetBridgeTruss,
  presetSimpleFrame,
  jetColormap,
} from '../utils/fea-solver';

export interface ExtremeInfo {
  elementId: number | null;
  nodeId: number | null;
  value: number;
  x: number;
  y: number;
}

export const useFEAStore = defineStore('fea', () => {
  const model = ref<FEAModel>({ nodes: [], elements: [], loads: [] });
  const result = ref<FEAResult | null>(null);
  const selectedPreset = ref<string>('cantilever');
  const showDeformed = ref(false);
  const deformationScale = ref(10);
  const selectedElement = ref<number | null>(null);
  const heatmapMode = ref<'stress' | 'strain' | 'force'>('stress');
  const focusTarget = ref<{ x: number; y: number } | null>(null);

  // ─── Actions ──────────────────────────────────────────────────────────────
  function loadPreset(name: string) {
    selectedPreset.value = name;
    result.value = null;
    selectedElement.value = null;
    switch (name) {
      case 'cantilever':
        model.value = presetCantileverBeam();
        break;
      case 'bridge':
        model.value = presetBridgeTruss();
        break;
      case 'frame':
        model.value = presetSimpleFrame();
        break;
      default:
        model.value = presetCantileverBeam();
    }
  }

  function solve() {
    result.value = feaSolve(model.value);
  }

  function toggleDeformed() {
    showDeformed.value = !showDeformed.value;
  }

  function selectElement(id: number | null) {
    selectedElement.value = id;
  }

  function setHeatmapMode(mode: 'stress' | 'strain' | 'force') {
    heatmapMode.value = mode;
  }

  function addLoad(nodeId: number, fx: number, fy: number) {
    model.value.loads.push({ nodeId, fx, fy });
  }

  function toggleFixed(nodeId: number) {
    const node = model.value.nodes.find((n) => n.id === nodeId);
    if (node) node.fixed = !node.fixed;
  }

  function focusOn(x: number, y: number) {
    focusTarget.value = { x, y };
  }

  function clearFocus() {
    focusTarget.value = null;
  }

  // ─── Computed ─────────────────────────────────────────────────────────────
  const maxStress = computed(() => {
    if (!result.value) return 0;
    return result.value.maxStress;
  });

  const maxDisplacement = computed(() => {
    if (!result.value) return 0;
    return result.value.maxDisplacement;
  });

  const elementCenter = (elementId: number): { x: number; y: number } => {
    const el = model.value.elements.find((e) => e.id === elementId);
    if (!el) return { x: 0, y: 0 };
    const n1 = model.value.nodes.find((n) => n.id === el.nodeIds[0]);
    const n2 = model.value.nodes.find((n) => n.id === el.nodeIds[1]);
    if (!n1 || !n2) return { x: 0, y: 0 };
    return { x: (n1.x + n2.x) / 2, y: (n1.y + n2.y) / 2 };
  };

  const stressExtremes = computed<{ max: ExtremeInfo; min: ExtremeInfo } | null>(() => {
    if (!result.value || model.value.elements.length === 0) return null;
    const { stresses } = result.value;
    let maxIdx = 0, minIdx = 0;
    for (let i = 1; i < stresses.length; i++) {
      if (stresses[i] > stresses[maxIdx]) maxIdx = i;
      if (stresses[i] < stresses[minIdx]) minIdx = i;
    }
    const maxEl = model.value.elements[maxIdx];
    const minEl = model.value.elements[minIdx];
    const maxCenter = elementCenter(maxEl.id);
    const minCenter = elementCenter(minEl.id);
    return {
      max: { elementId: maxEl.id, nodeId: null, value: stresses[maxIdx], x: maxCenter.x, y: maxCenter.y },
      min: { elementId: minEl.id, nodeId: null, value: stresses[minIdx], x: minCenter.x, y: minCenter.y },
    };
  });

  const strainExtremes = computed<{ max: ExtremeInfo; min: ExtremeInfo } | null>(() => {
    if (!result.value || model.value.elements.length === 0) return null;
    const { strains } = result.value;
    let maxIdx = 0, minIdx = 0;
    for (let i = 1; i < strains.length; i++) {
      if (strains[i] > strains[maxIdx]) maxIdx = i;
      if (strains[i] < strains[minIdx]) minIdx = i;
    }
    const maxEl = model.value.elements[maxIdx];
    const minEl = model.value.elements[minIdx];
    const maxCenter = elementCenter(maxEl.id);
    const minCenter = elementCenter(minEl.id);
    return {
      max: { elementId: maxEl.id, nodeId: null, value: strains[maxIdx], x: maxCenter.x, y: maxCenter.y },
      min: { elementId: minEl.id, nodeId: null, value: strains[minIdx], x: minCenter.x, y: minCenter.y },
    };
  });

  const displacementExtremes = computed<{ max: ExtremeInfo; min: ExtremeInfo } | null>(() => {
    if (!result.value || model.value.nodes.length === 0) return null;
    let maxIdx = 0, minIdx = 0;
    let maxMag = -Infinity, minMag = Infinity;
    for (let i = 0; i < model.value.nodes.length; i++) {
      const n = model.value.nodes[i];
      const mag = Math.sqrt(n.displacementX ** 2 + n.displacementY ** 2);
      if (mag > maxMag) { maxMag = mag; maxIdx = i; }
      if (mag < minMag) { minMag = mag; minIdx = i; }
    }
    const maxNode = model.value.nodes[maxIdx];
    const minNode = model.value.nodes[minIdx];
    return {
      max: { elementId: null, nodeId: maxNode.id, value: maxMag, x: maxNode.x, y: maxNode.y },
      min: { elementId: null, nodeId: minNode.id, value: minMag, x: minNode.x, y: minNode.y },
    };
  });

  const elementColors = computed(() => {
    const colors = new Map<number, string>();
    if (!result.value || model.value.elements.length === 0) {
      for (const el of model.value.elements) {
        colors.set(el.id, '#6b7280');
      }
      return colors;
    }

    let values: number[];
    switch (heatmapMode.value) {
      case 'stress':
        values = result.value.stresses.map(Math.abs);
        break;
      case 'strain':
        values = result.value.strains.map(Math.abs);
        break;
      case 'force':
        values = model.value.elements.map((e) => Math.abs(e.force));
        break;
      default:
        values = result.value.stresses.map(Math.abs);
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    for (let i = 0; i < model.value.elements.length; i++) {
      colors.set(
        model.value.elements[i].id,
        jetColormap(values[i], min, max)
      );
    }
    return colors;
  });

  return {
    model,
    result,
    selectedPreset,
    showDeformed,
    deformationScale,
    selectedElement,
    heatmapMode,
    focusTarget,
    maxStress,
    maxDisplacement,
    stressExtremes,
    strainExtremes,
    displacementExtremes,
    elementColors,
    loadPreset,
    solve,
    toggleDeformed,
    selectElement,
    setHeatmapMode,
    addLoad,
    toggleFixed,
    focusOn,
    clearFocus,
  };
});
