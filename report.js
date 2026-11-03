(() => {
  // Получите API key в настройках Trello Power-Up и подставьте его сюда.
  const TRELLO_API_KEY = "ВСТАВЬТЕ_TRELLO_API_KEY";

  const t = TrelloPowerUp.iframe();
  const message = document.getElementById("message");
  const authorizeButton = document.getElementById("authorize");
  const refreshButton = document.getElementById("refresh");
  const periodSelect = document.getElementById("period");

  let boardId = null;
  let cards = [];
  let lists = [];

  function showMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("error", isError);
  }

  async function getToken() {
    let token = await t.get("member", "private", "authToken");

    if (!token) {
      authorizeButton.hidden = false;
      showMessage("Чтобы создать отчёт, разрешите Power-Up читать карточки доски.");
      return null;
    }

    authorizeButton.hidden = true;
    return token;
  }

  async function authorize() {
    try {
      await t.authorize({
        scope: { read: true, write: false },
        expiration: "never"
      });

      await loadReport();
    } catch (error) {
      showMessage("Не удалось получить доступ. Попробуйте ещё раз.", true);
      console.error(error);
    }
  }

  async function loadReport() {
    try {
      showMessage("Загружаем данные доски…");

      if (!boardId) {
        boardId = await t.get("board", "id");
      }

      const token = await getToken();
      if (!token) return;

      const query = new URLSearchParams({
        key: TRELLO_API_KEY,
        token,
        filter: "all",
        fields: "name,idList,idMembers,labels,due,dueComplete,closed,dateLastActivity,url"
      });

      const [cardsResponse, listsResponse] = await Promise.all([
        fetch(`https://api.trello.com/1/boards/${boardId}/cards?${query}`),
        fetch(`https://api.trello.com/1/boards/${boardId}/lists?${query}`)
      ]);

      if (!cardsResponse.ok || !listsResponse.ok) {
        throw new Error("Trello API вернул ошибку.");
      }

      [cards, lists] = await Promise.all([
        cardsResponse.json(),
        listsResponse.json()
      ]);

      renderReport();
    } catch (error) {
      showMessage(
        "Не удалось загрузить отчёт. Проверьте API key и разрешение на чтение доски.",
        true
      );
      console.error(error);
    }
  }

  function renderReport() {
    const days = Number(periodSelect.value);
    const cutoff = days
      ? Date.now() - days * 24 * 60 * 60 * 1000
      : 0;

    const activeInPeriod = cards.filter(card => {
      if (!card.dateLastActivity) return false;
      return new Date(card.dateLastActivity).getTime() >= cutoff;
    }).length;

    const completed = cards.filter(card => card.closed);
    const open = cards.filter(card => !card.closed);

    document.getElementById("total").textContent = cards.length;
    document.getElementById("completed").textContent = completed.length;
    document.getElementById("open").textContent = open.length;
    document.getElementById("active").textContent = activeInPeriod;

    const rows = document.getElementById("list-rows");
    rows.replaceChildren();

    for (const list of lists) {
      const listCards = cards.filter(card => card.idList === list.id);
      const doneCount = listCards.filter(card => card.closed).length;
      const openCount = listCards.length - doneCount;

      const row = document.createElement("tr");
      for (const value of [list.name, listCards.length, doneCount, openCount]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      }
      rows.appendChild(row);
    }

    document.getElementById("report").hidden = false;
    showMessage("Отчёт готов.");
  }

  authorizeButton.addEventListener("click", authorize);
  refreshButton.addEventListener("click", loadReport);
  periodSelect.addEventListener("change", renderReport);

  loadReport();
})();
