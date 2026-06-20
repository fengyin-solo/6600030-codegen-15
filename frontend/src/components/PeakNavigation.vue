<script setup lang="ts">
import { computed } from 'vue';
import { useFEAStore, type ExtremeInfo } from '../store/fea';

const store = useFEAStore();

interface PeakItem {
  label: string;
  kind: 'max' | 'min';
  value: number;
  unit: string;
  elementId: number | null;
  nodeId: number | null;
  x: number;
  y: number;
  accentColor: string;
}

const formatValue = (v: number, unit: string): string => {
  if (unit === 'MPa') {
    return (v / 1e6).toFixed(2);
  }
  if (unit === '%') {
    return (v * 100).toFixed(4);
  }
  if (unit === 'mm') {
    return (v * 1000).toFixed(3);
  }
  return v.toExponential(2);
};

const peaks = computed<{ title: string; color: string; items: PeakItem[] }[]>(() => {
  const groups: { title: string; color: string; items: PeakItem[] }[] = [];

  if (store.stressExtremes) {
    groups.push({
      title: '应力',
      color: 'text-rose-400',
      items: [
        {
          label: '最大拉应力',
          kind: 'max',
          value: store.stressExtremes.max.value,
          unit: 'MPa',
          elementId: store.stressExtremes.max.elementId,
          nodeId: null,
          x: store.stressExtremes.max.x,
          y: store.stressExtremes.max.y,
          accentColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        },
        {
          label: '最大压应力',
          kind: 'min',
          value: store.stressExtremes.min.value,
          unit: 'MPa',
          elementId: store.stressExtremes.min.elementId,
          nodeId: null,
          x: store.stressExtremes.min.x,
          y: store.stressExtremes.min.y,
          accentColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
        },
      ],
    });
  }

  if (store.strainExtremes) {
    groups.push({
      title: '应变',
      color: 'text-cyan-400',
      items: [
        {
          label: '最大正应变',
          kind: 'max',
          value: store.strainExtremes.max.value,
          unit: '%',
          elementId: store.strainExtremes.max.elementId,
          nodeId: null,
          x: store.strainExtremes.max.x,
          y: store.strainExtremes.max.y,
          accentColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        },
        {
          label: '最大负应变',
          kind: 'min',
          value: store.strainExtremes.min.value,
          unit: '%',
          elementId: store.strainExtremes.min.elementId,
          nodeId: null,
          x: store.strainExtremes.min.x,
          y: store.strainExtremes.min.y,
          accentColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
        },
      ],
    });
  }

  if (store.displacementExtremes) {
    groups.push({
      title: '位移',
      color: 'text-amber-400',
      items: [
        {
          label: '最大位移',
          kind: 'max',
          value: store.displacementExtremes.max.value,
          unit: 'mm',
          elementId: null,
          nodeId: store.displacementExtremes.max.nodeId,
          x: store.displacementExtremes.max.x,
          y: store.displacementExtremes.max.y,
          accentColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        },
        {
          label: '最小位移',
          kind: 'min',
          value: store.displacementExtremes.min.value,
          unit: 'mm',
          elementId: null,
          nodeId: store.displacementExtremes.min.nodeId,
          x: store.displacementExtremes.min.x,
          y: store.displacementExtremes.min.y,
          accentColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
        },
      ],
    });
  }

  return groups;
});

function navigateTo(item: PeakItem) {
  store.focusOn(item.x, item.y);
  if (item.elementId !== null) {
    store.selectElement(item.elementId);
  } else {
    store.selectElement(null);
  }
}
</script>

<template>
  <div class="bg-slate-800 rounded-lg p-4">
    <h3 class="text-sm font-bold text-slate-200 border-b border-slate-700 pb-2 mb-3 flex items-center gap-2">
      <span class="text-purple-400">📍</span>
      极值导航
    </h3>

    <div v-if="!store.result" class="text-xs text-slate-500 text-center py-6">
      先点击"求解"查看极值定位
    </div>

    <div v-else class="space-y-4">
      <div v-for="group in peaks" :key="group.title" class="space-y-1.5">
        <div class="text-[11px] font-semibold uppercase tracking-wider" :class="group.color">
          {{ group.title }}
        </div>
        <div class="space-y-1.5">
          <button
            v-for="item in group.items"
            :key="item.label"
            class="w-full text-left rounded-md border px-2.5 py-2 transition-all hover:brightness-125 active:scale-[0.98]"
            :class="item.accentColor"
            @click="navigateTo(item)"
          >
            <div class="flex items-center justify-between">
              <span class="text-[11px] opacity-80">{{ item.label }}</span>
              <span class="text-[10px] opacity-60 font-mono">
                {{ item.elementId !== null ? `单元#${item.elementId}` : `节点#${item.nodeId}` }}
              </span>
            </div>
            <div class="mt-0.5 flex items-baseline gap-1">
              <span class="text-sm font-bold font-mono">
                {{ formatValue(item.value, item.unit) }}
              </span>
              <span class="text-[10px] opacity-70">{{ item.unit }}</span>
              <span class="ml-auto text-[10px] opacity-50">点击跳转 →</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
