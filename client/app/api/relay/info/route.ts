import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: process.env.RELAYER_NAME ?? "Lisan Default",
    address: process.env.RELAYER_ADDRESS ?? "",
    feeBps: Number(process.env.RELAYER_FEE_BPS ?? "50"),
  });
}
