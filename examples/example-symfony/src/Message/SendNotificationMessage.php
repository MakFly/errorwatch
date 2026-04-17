<?php

namespace App\Message;

/**
 * Fake user notification — dispatched from `/trigger/queue`,
 * processed by the Messenger worker (`bin/console messenger:consume async`).
 *
 * Used to demonstrate the ErrorWatch queue.publish + queue.process spans.
 */
final class SendNotificationMessage
{
    public function __construct(
        public readonly string $userEmail,
        public readonly string $subject,
        public readonly string $body,
    ) {
    }
}
