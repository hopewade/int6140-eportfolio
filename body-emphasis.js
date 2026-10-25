/* Preserve manuscript text; reveal a small selection of its existing key claims. */
(() => {
  'use strict';
  const phrases = [
    '从开发工具延伸至职责、评价与利益分配',
    '代码生成使使用者能够通过自然语言描述需求',
    '降低业务需求转化为系统的技术门槛',
    '人事管理、报价核算、生产跟单系统、财务系统和产值系统',
    '将业务人员掌握的需求和规则转化为可运行的工具',
    '系统维护与数据判断的要求也随之增加',
    '同薪扩责和多项紧急任务难以兼顾',
    '新增测算就容易叠加在生产任务之上',
    '数字化带来的效率提升与职责扩大可能同时发生',
    '企业有必要提前识别培养和接替需求',
    '从“有人能够开发”，进一步转向“有人能够理解、使用和维护”',
    '明确接手、维护和带教责任，并预留学习时间',
    '单项任务节时并不意味着员工整体负担下降',
    '应同时审视工作量、时间压力及可获得的支持资源',
    '任务增加而配套资源不足',
    '职责测算—负荷与意愿评估—培训—试行—效果评估与激励',
    '新增工时减去原任务实际释放工时',
    '员工不愿意或尚未准备好时，先沟通原因并调整方案',
    '还须确认质量、员工负荷及支援安排可持续',
    '其缓解压力、改善福祉的实际效果仍有待实践检验',
    '经营数字化的价值，不能只看业务效率，同样要看新增职责如何分配、员工福祉是否得到保护',
    '必须将岗位负荷、员工公平感知、福祉状态纳入衡量维度',
    '主动识别数字化带来的职责无序扩张风险',
    '成长为兼顾业务经营与员工福祉的业务型 HRBP',
    '完成理论、工具与实务案例的双向积累',
    '能够识别数字化带来的岗位职责扩张及其潜在福祉风险',
    '通过小范围试点检验新增职责评估闭环机制的现实适配性',
    '积累可迁移的 HRBP 项目实践经验',
    '推动负荷评估理念融入组织管理',
    '具备平衡业务发展与员工福祉的综合 HRBP 能力'
  ];
  const paragraphSelector = [
    '.imported-about-prose p',
    '#research p.research-prose',
    '#research p.research-conclusion',
    '#research .role-pain p',
    '#wellbeing .final-copy-prose',
    '#reflection .final-copy-prose',
    '#career-content-library .career-stage-prose',
    '#career-dialog-content .career-stage-prose'
  ].join(',');

  function start() {
    if (document.documentElement.dataset.bodyEmphasis === 'ready') return;
    const marks = [];
    for (const paragraph of document.querySelectorAll(paragraphSelector)) {
      // One key claim per paragraph; citations and existing semantic elements stay intact.
      const phrase = phrases.find(candidate => paragraph.textContent.includes(candidate));
      if (!phrase) continue;
      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.parentElement || node.parentElement.closest('a, strong, .body-emphasis, script, style')) {
            return NodeFilter.FILTER_REJECT;
          }
          return node.data.includes(phrase) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      });
      const source = walker.nextNode();
      if (!source) continue;
      const offset = source.data.indexOf(phrase);
      const match = source.splitText(offset);
      match.splitText(phrase.length);
      const strong = document.createElement('strong');
      strong.className = 'body-emphasis';
      source.parentNode.insertBefore(strong, match);
      strong.appendChild(match);
      marks.push(strong);
    }
    document.documentElement.dataset.bodyEmphasis = 'ready';
    document.documentElement.dataset.bodyEmphasisCount = String(marks.length);
    if (!marks.length) return;

    const reduced = window.PortfolioMotion?.preference || (window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null);
    const reveal = mark => mark.classList.add('is-emphasized');
    let observer = null;
    if (!('IntersectionObserver' in window) || (reduced && reduced.matches)) {
      marks.forEach(reveal);
    } else {
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          reveal(entry.target);
          observer.unobserve(entry.target);
        }
      }, { threshold: 0.2, rootMargin: '0px 0px -12% 0px' });
      // Allow a normal-weight first paint even when this script loads late.
      const nextPaint = window.requestAnimationFrame || (callback => window.setTimeout(callback, 16));
      nextPaint(() => nextPaint(() => marks.forEach(mark => observer.observe(mark))));
    }
    const showAll = event => {
      if (!event.matches) return;
      if (observer) observer.disconnect();
      marks.forEach(reveal);
    };
    if (reduced) {
      if (reduced.addEventListener) reduced.addEventListener('change', showAll);
      else if (reduced.addListener) reduced.addListener(showAll);
    }
    // The same manuscript nodes move into the career dialog; no text copy is made.
    const dialog = document.getElementById('career-level-dialog');
    if (dialog && 'MutationObserver' in window) {
      const dialogObserver = new MutationObserver(() => {
        if (!dialog.open) return;
        for (const mark of dialog.querySelectorAll('.body-emphasis')) {
          reveal(mark);
          if (observer) observer.unobserve(mark);
        }
      });
      dialogObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
