const GROUP_ORDER = ["Public", "News", "Networks"];

function uploadsUrl(channelId, autoplay) {
  // Channel uploads playlist (UC... -> UU...). A playlist embed auto-advances
  // through the channel's uploads, so it keeps playing without further clicks.
  // autoplay=1 is only set on a user-initiated pick: browsers require a user
  // gesture to start playback with sound, which a chip click satisfies.
  const base = "https://www.youtube.com/embed/videoseries?list=UU" + channelId.slice(2);
  return autoplay ? base + "&autoplay=1" : base;
}
function liveLink(channelId) {
  // Opens the channel's current live broadcast on YouTube (or its "not live" page).
  return "https://www.youtube.com/channel/" + channelId + "/live";
}

const player = document.getElementById("player");
const npMode = document.getElementById("np-mode");
const npName = document.getElementById("np-name");
const rail = document.getElementById("rail");
const errorBox = document.getElementById("error");

let selectedChip = null;

function isValidChannel(channel) {
  return channel && typeof channel.youtubeChannelId === "string"
    && channel.youtubeChannelId.startsWith("UC");
}

function play(channel, chipEl, autoplay) {
  player.src = uploadsUrl(channel.youtubeChannelId, autoplay);
  npMode.textContent = "⏭ Latest";
  npName.textContent = channel.name;
  if (selectedChip) selectedChip.classList.remove("selected");
  if (chipEl) { chipEl.classList.add("selected"); selectedChip = chipEl; }
}

function makeChip(channel) {
  const chip = document.createElement("div");
  chip.className = "chip";

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = channel.name;

  const net = document.createElement("div");
  net.className = "net";
  net.textContent = channel.network + (channel.note ? " · " + channel.note : "");

  const btns = document.createElement("div");
  btns.className = "btns";

  const latestBtn = document.createElement("button");
  latestBtn.className = "latest";
  latestBtn.textContent = "⏭ Latest";
  latestBtn.setAttribute("aria-label", "Play " + channel.name + " latest uploads");
  latestBtn.addEventListener("click", () => play(channel, chip, true));
  btns.appendChild(latestBtn);

  // Channels that run live streams get a link that opens the live on YouTube
  // (embedding their live isn't possible without an API key).
  if (channel.hasLive) {
    const live = document.createElement("a");
    live.className = "live-link";
    live.href = liveLink(channel.youtubeChannelId);
    live.target = "_blank";
    live.rel = "noopener";
    live.textContent = "▶ Live ↗";
    live.setAttribute("aria-label", "Open " + channel.name + " live on YouTube (new tab)");
    btns.appendChild(live);
  }

  chip.append(name, net, btns);
  return chip;
}

function render(channels) {
  const valid = channels.filter(c => {
    if (!isValidChannel(c)) { console.warn("Skipping channel with invalid youtubeChannelId:", c); return false; }
    return true;
  });
  if (valid.length === 0) { showError(); return; }

  const groups = {};
  for (const ch of valid) (groups[ch.group || "Networks"] ||= []).push(ch);
  const orderedKeys = [
    ...GROUP_ORDER.filter(g => groups[g]),
    ...Object.keys(groups).filter(g => !GROUP_ORDER.includes(g)),
  ];

  let firstChannel = null, firstChip = null;
  let firstLiveChannel = null, firstLiveChip = null;

  for (const key of orderedKeys) {
    const section = document.createElement("div");
    section.className = "rail-group";
    const h = document.createElement("h2"); h.textContent = key;
    const chips = document.createElement("div"); chips.className = "chips";
    for (const ch of groups[key]) {
      const chip = makeChip(ch);
      if (!firstChip) { firstChip = chip; firstChannel = ch; }
      if (!firstLiveChip && ch.hasLive) { firstLiveChip = chip; firstLiveChannel = ch; }
      chips.appendChild(chip);
    }
    section.append(h, chips);
    rail.appendChild(section);
  }

  // First load: default to a channel that runs live (its uploads are reliably
  // embeddable worldwide), else the first valid channel. Plays latest uploads.
  if (firstLiveChannel) play(firstLiveChannel, firstLiveChip);
  else if (firstChannel) play(firstChannel, firstChip);
}

function showError() {
  errorBox.hidden = false;
  // Static literal only — never interpolate user/JSON data here (XSS).
  errorBox.innerHTML = 'Could not load the channel list. See the <a href="../tv.md">Markdown TV guide</a> instead.';
}

fetch("channels.json")
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(data => {
    if (!data || !Array.isArray(data.channels) || data.channels.length === 0) throw new Error("empty");
    render(data.channels);
  })
  .catch(showError);
