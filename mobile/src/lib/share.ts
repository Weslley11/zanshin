import { Platform, Share } from "react-native";

/** Exporta um relatório: compartilhamento nativo no celular, download de arquivo no navegador. */
export async function shareText(filename: string, text: string) {
  if (Platform.OS === "web") {
    // iPhone/Android: folha de compartilhamento com arquivo ("Salvar em Arquivos"); senão, download.
    try {
      const file = new File([text], filename, { type: filename.endsWith(".json") ? "application/json" : "text/plain" });
      const nav: any = navigator;
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: filename });
        return;
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return; // a pessoa fechou a folha de compartilhamento
    }
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ message: text, title: filename });
}
