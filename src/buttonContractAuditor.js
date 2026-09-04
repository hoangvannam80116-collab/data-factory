export class ButtonContractAuditor {
  constructor(root = document) {
    this.root = root;
  }

  inspect() {
    const buttons = Array.from(this.root.querySelectorAll('button'))
      .filter(button => this.#isVisible(button));
    const items = buttons.map((button, index) => {
      const name = this.#accessibleName(button);
      return {
        index,
        name,
        enabled: !button.disabled,
        visible: true,
        problem: name ? '' : '按钮缺少可访问名称'
      };
    });

    return {
      total: items.length,
      enabled: items.filter(item => item.enabled).length,
      disabled: items.filter(item => !item.enabled).length,
      problems: items.filter(item => item.problem),
      items
    };
  }

  #accessibleName(button) {
    return String(
      button.getAttribute('aria-label')
      || button.getAttribute('title')
      || button.innerText
      || button.textContent
      || ''
    ).replace(/\s+/g, ' ').trim();
  }

  #isVisible(element) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && Number(style.opacity) > 0
      && rect.width > 0
      && rect.height > 0;
  }
}
