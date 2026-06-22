import { Controller, Get, Header, Param, Res } from "@nestjs/common";
import { Response } from "express";
import { createReadStream, existsSync } from "fs";
import { join, normalize } from "path";

const WEB_ROOT = join(__dirname, "..", "dist-web");
const MIME_TYPES: Record<string, string> = {
  css: "text/css; charset=utf-8",
  html: "text/html; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml; charset=utf-8"
};

@Controller()
export class StaticController {
  @Get()
  @Header("Cache-Control", "no-store")
  index(@Res() res: Response) {
    return this.sendFile(res, "index.html");
  }

  @Get("*")
  @Header("Cache-Control", "public, max-age=31536000, immutable")
  asset(@Param("0") assetPath: string, @Res() res: Response) {
    if (assetPath.startsWith("api/")) {
      res.status(404).send("Not found");
      return;
    }
    const sent = this.sendFile(res, assetPath);
    if (!sent) this.sendFile(res, "index.html", "no-store");
  }

  private sendFile(res: Response, requestedPath: string, cacheControl?: string) {
    const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
    const fullPath = join(WEB_ROOT, safePath);
    if (!fullPath.startsWith(WEB_ROOT) || !existsSync(fullPath)) return false;
    const ext = fullPath.split(".").pop() || "";
    res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
    if (cacheControl) res.setHeader("Cache-Control", cacheControl);
    createReadStream(fullPath).pipe(res);
    return true;
  }
}
