const RPC = require("discord-rpc");
const client = new RPC.Client({ transport: "ipc" });

const clientId = "916284732675870740"; // Ganti dengan Application ID dari Discord Developer Portal

async function setActivity() {
  if (!client) return;

  client.setActivity({
    details: "マキマ", // Deskripsi aktivitas
    state: "100% introvert", // Status tambahan
    largeImageKey: "chainsaw_man_makima", // Nama gambar dari Art Assets
    largeImageText: "Kapan Yah", // Tooltip saat hover gambar
    startTimestamp: Date.now(),
    buttons: [{ label: "フリーレン", url: "https://frieren.fandom.com/wiki/Frieren" }]
  });
}

client.on("ready", () => {
  console.log("Rich Presence aktif!");
  setActivity();
});

client.login({ clientId }).catch(console.error);