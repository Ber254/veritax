import type { NextApiRequest, NextApiResponse } from "next";
import { sendError, sendJson } from "@/lib/json";
import { loadDeployment } from "@/lib/server";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    sendJson(res, loadDeployment().file);
  } catch (err) {
    sendError(res, err, 503);
  }
}
