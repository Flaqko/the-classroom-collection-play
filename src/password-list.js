export function populatePasswords(panel, entries) {
  const field = panel.querySelector('input');
  const items = entries.map(({label, password}) => {
    const item = document.createElement('li');
    const choice = document.createElement('button');
    const code = document.createElement('code');
    choice.type = 'button';
    choice.setAttribute('aria-pressed', 'false');
    choice.className = 'password-choice';
    code.textContent = password;
    choice.append(label, code);
    choice.addEventListener('click', () => {
      field.value = password;
      panel.querySelector('.password-choice[aria-pressed=true]')?.setAttribute('aria-pressed', 'false');
      choice.setAttribute('aria-pressed', 'true');
    });
    item.append(choice);
    return item;
  });
  panel.querySelector('ol').replaceChildren(...items);
}

export function resetPasswordSelection(panel) {
  panel.querySelector('input').value = '';
  panel.querySelector('.password-choice[aria-pressed=true]')?.setAttribute('aria-pressed', 'false');
  panel.querySelector('.password-choice')?.focus({preventScroll: true});
}
