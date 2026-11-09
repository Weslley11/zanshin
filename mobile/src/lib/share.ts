import { Platform, Share } from "react-native";

/** Exporta um relatório: compartilhamento nativo no celular, download de arquivo no navegador. */
export async function shareText(filename: string, text: string) {
  if (Platform.OS === "web") {
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
