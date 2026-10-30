/**
 * 战斗（魔塔式）
 * ------------------------------------------------------------------
 * 点它一下 = 一回合：你打，它还手。没有站位、没有技能、没有随机数，
 * 所以「打不打得过」在开打之前就能算出来：
 *
 *   回合数 = 它的血 / 你的攻（向上取整）
 *   你要掉的 = 它的攻 × (回合数 - 1)      // 你先手，最后一回合它没机会还
 *
 * 这就是魔塔的味道：**伤血是确定的**，要不要打是玩家的事。
 * 打不过就别碰——绕过去只挨一口，比硬拼便宜。
 */

import { damage, run, playerAtk } from './run';
import { rollLoot, money, type Loot } from './loot';
import { bag } from './bag';
import { toast } from './hud';
import type { BeastInstance } from './beasts';

/** 玩家的攻击力：现在没有装备系统，先固定 */
/** 玩家的攻击力：4 + 商店里买的那点 */

type Outcome = { win: boolean; drops: Loot[] };

let active: BeastInstance | null = null;

const hitOne = (beast: BeastInstance): void => {
  beast.hp = Math.max(0, beast.hp - playerAtk());
};

/** 打一只：返回它还能还手几下 */
const roundsToKill = (beast: BeastInstance): number => Math.ceil(beast.hp / playerAtk());

export function openFight(beast: BeastInstance, onDone?: (out: Outcome) => void): void {
  const stage = document.querySelector<HTMLElement>('[data-dive-stage]');
  if (!stage || active) return;
  active = beast;

  const veil = document.createElement('div');
  veil.className = 'fight';
  veil.dataset.fight = '';

  const render = (): void => {
    const rounds = roundsToKill(beast);
    const cost = beast.kind.atk * Math.max(0, rounds - 1);
    veil.innerHTML =
      `<div class="fight-card">` +
      `<div class="fight-top">` +
      `<p class="fight-eyebrow">遭遇 · ${beast.kind.rank}</p>` +
      `<h2 class="fight-title">${beast.kind.name}</h2>` +
      `<p class="fight-desc">${beast.kind.desc}</p>` +
      `</div>` +
      `<div class="fight-arena">` +
      `<button class="fight-self" type="button" disabled>` +
      `<span class="fight-self-label">你</span>` +
      `<b class="fight-self-hp">${Math.round(run.hp)}</b>` +
      `<i>攻 ${playerAtk()}</i>` +
      `</button>` +
      `<span class="fight-vs">×</span>` +
      `<button class="fight-beast" type="button" data-hit style="--size:${beast.kind.w}">` +
      `<span class="fight-beast-art"><svg viewBox="0 0 24 24">${beast.kind.icon}</svg></span>` +
      `<b class="fight-beast-name">${beast.kind.name}</b>` +
      `<span class="fight-beast-meta">${beast.kind.w}×${beast.kind.h} · 血 ${beast.hp}/${beast.maxHp} · 攻 ${beast.kind.atk}</span>` +
      `<span class="fight-beast-bar"><i style="width:${(beast.hp / beast.maxHp) * 100}%"></i></span>` +
      `</button>` +
      `</div>` +
      `<p class="fight-calc">这一下要打 ${rounds} 回合，你会掉 ${cost} 点血` +
      (cost >= run.hp ? ' —— <b>打不过</b>' : '') +
      `</p>` +
      `<div class="fight-actions">` +
      `<button class="fight-btn fight-btn--flee" type="button" data-flee>退（挨一口，${beast.kind.atk} 点）</button>` +
      `<button class="fight-btn" type="button" data-hit>打一下</button>` +
      `</div>` +
      `</div>`;
  };

  const finish = (win: boolean): void => {
    const drops: Loot[] = [];
    if (win) {
      const n = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        const loot = rollLoot((run.floor - 1) * 2600 + 2400);
        if (bag?.add(loot)) {
          drops.push(loot);
        } else {
          toast('背包放不下了');
          break;
        }
      }
    }
  veil.remove();
    active = null;
    onDone?.({ win, drops });
    if (win) {
      const total = drops.reduce((s, d) => s + d.price, 0);
      toast(drops.length ? `赢了 · 捡到 ${drops.length} 件（约 ${money(total)}）` : '赢了 · 什么都没有');
    }
  };

  veil.addEventListener('click', (event) => {
    const el = event.target as HTMLElement;

    if (el.closest('[data-flee]')) {
      damage(beast.kind.atk);
      if (run.alive) toast(`退了 · 挨了一口 ${beast.kind.atk} 点`);
      finish(false);
      return;
    }

    if (el.closest('[data-hit]')) {
      if (beast.hp <= 0) return;
      hitOne(beast);
      if (beast.hp <= 0) {
        finish(true);
        return;
      }
      // 它还没死：还手
      damage(beast.kind.atk);
      if (!run.alive) {
        finish(false);
        return;
      }
      render();
    }
  });

  render();
  stage.append(veil);
  requestAnimationFrame(() => veil.classList.add('is-on'));
}

/** 这只怪打死/打跑了，路上那张卡就该消失 */
export function isFighting(): boolean {
  return active !== null;
}

// 调试用
(window as unknown as { __fight?: unknown }).__fight = (beast: BeastInstance) => openFight(beast);
