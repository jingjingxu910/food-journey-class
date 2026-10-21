const appVersion = "0.2.0";

const params = new URLSearchParams(location.search);
const groupId = Number(params.get("group"));

if (Number.isInteger(groupId) && groupId >= 1 && groupId <= 12) {
  document.querySelector(".topbar-badge").textContent = `第 ${groupId} 组`;
  document.querySelectorAll('a[href$=".html"]').forEach((link) => {
    const url = new URL(link.href);
    url.searchParams.set("group", groupId);
    link.href = url.href;
  });
}

console.info(`食物在身体里的旅行 v${appVersion}`);
