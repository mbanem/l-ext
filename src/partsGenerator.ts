import * as vscode from 'vscode'
import { copySelectedComponents } from './copyComponents.js'
export function generateParts(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  channel: vscode.OutputChannel,
  paths: TPaths,
  payload: Payload,
) {
  channel.appendLine(
    `[generateParts] calling copySelectedComponents, ${JSON.stringify(payload, null, 2)}`,
  )
  channel.appendLine(
    `[generateParts] components? ${JSON.stringify(payload.crComponents, null, 2)}`,
  )
  copySelectedComponents(
    context,
    paths.root,
    payload.crComponents as Components,
  )
}
