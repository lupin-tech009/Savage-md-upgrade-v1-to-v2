
import { logger } from '../logger.js';

const DEFAULT_PREFIX = '$';

export class MessageHandler {
  constructor({
    customerService,
    groupWorkflow,
    commandPrefix = DEFAULT_PREFIX
  } = {}) {
    if (!customerService || !groupWorkflow) {
      throw new Error(
        'MessageHandler requires customerService and groupWorkflow.'
      );
    }

    this.customerService = customerService;
    this.groupWorkflow = groupWorkflow;
    this.commandPrefix = commandPrefix;
  }

  async handle(customerId, message) {
    try {
      const key = message?.key;
      const remoteJid = key?.remoteJid;

      if (!remoteJid || key?.fromMe) {
        return;
      }

      // Never execute commands in private chats.
      if (!remoteJid.endsWith('@g.us')) {
        return;
      }

      const messageText = this.extractText(message);

      if (!messageText.startsWith(this.commandPrefix)) {
        return;
      }

      const customer = await this.customerService.getCustomer(
        customerId
      );

      if (!customer || customer.status !== 'active') {
        return;
      }

      const sender = this.extractSender(key);

      if (!sender) {
        return;
      }

      const authorized = await this.customerService.isAuthorizedGroupUser({
        customerId,
        sender,
        groupId: remoteJid
      });

      if (!authorized) {
        logger.warn(
          { customerId, groupId: remoteJid },
          'Unauthorized group command ignored.'
        );

        return;
      }

      await this.groupWorkflow.handleCommand({
        customerId,
        groupId: remoteJid,
        sender,
        command: messageText.slice(this.commandPrefix.length).trim(),
        message
      });
    } catch (error) {
      logger.error(
        { customerId, error: error.message },
        'Incoming WhatsApp message processing failed.'
      );
    }
  }

  extractText(message) {
    const content = message?.message;

    if (!content) {
      return '';
    }

    return (
      content.conversation ||
      content.extendedTextMessage?.text ||
      content.imageMessage?.caption ||
      content.videoMessage?.caption ||
      ''
    ).trim();
  }

  extractSender(key) {
    return (
      key.participant ||
      key.remoteJid
    ).split('@')[0].split(':')[0];
  }
}
