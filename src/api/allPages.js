// Every row of a list, page after page: the API pages by 100 at most, whatever `page_size` asks for.
export async function allPages(get) {
  const rows = [];
  for (let page = 1; ; page += 1) {
    const { data } = await get({ page, page_size: 100 });
    rows.push(...(data.results || []));
    if (!data.next) return rows;
  }
}
