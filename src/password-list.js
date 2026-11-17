export function populatePasswords(panel, entries) {
  const field = panel.querySelector('input');
  const items = entries.map(({label, password}) => {
    const item = document.createElement('li');
    const choice = document.createElement('button');
    const code = document.createElement('code');
    choice.type = 'button';
    choice.className = 'password-choice';
    code.textContent = password;
    choice.append(label, code);
    choice.addEventListener('click', () => {
      field.value = password;
      field.focus({preventScroll: true});
    });
    item.append(choice);
    return item;
  });
  panel.querySelector('ol').replaceChildren(...items);
}
