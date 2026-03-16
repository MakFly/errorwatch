<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use ErrorWatch\Laravel\Facades\ErrorWatch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class TestController extends Controller
{
    /**
     * Homepage — confirm the SDK is loaded and the app is running.
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'message' => 'ErrorWatch Laravel Example is running.',
            'sdk_enabled' => ErrorWatch::isEnabled(),
            'endpoints' => [
                'GET /'            => 'This page',
                'GET /error'       => 'Throws a RuntimeException (captured by ErrorWatch)',
                'GET /message'     => 'Sends a test message via ErrorWatch facade',
                'GET /breadcrumb'  => 'Adds breadcrumbs then throws (captured with breadcrumb trail)',
            ],
        ]);
    }

    /**
     * Throw an unhandled exception — ErrorWatch captures it automatically.
     */
    public function triggerError(Request $request): never
    {
        // The ErrorWatchExceptionHandler intercepts this before Laravel renders it.
        throw new RuntimeException(
            'This is a test exception from ErrorWatch Laravel Example. ' .
            'You should see this in your ErrorWatch dashboard.'
        );
    }

    /**
     * Send a manual message via the ErrorWatch facade.
     */
    public function sendMessage(): JsonResponse
    {
        $eventId = ErrorWatch::captureMessage(
            message: 'Test message from ErrorWatch Laravel Example',
            level: 'info',
            context: [
                'source' => 'TestController::sendMessage',
                'timestamp' => now()->toIso8601String(),
            ]
        );

        return response()->json([
            'status' => 'sent',
            'event_id' => $eventId,
            'message' => 'Test message dispatched to ErrorWatch. Check your dashboard.',
        ]);
    }

    /**
     * Add manual breadcrumbs, then throw to show the full breadcrumb trail.
     */
    public function triggerBreadcrumb(): never
    {
        ErrorWatch::addBreadcrumb(
            message: 'User reached the /breadcrumb route',
            type: 'navigation',
            data: ['url' => '/breadcrumb']
        );

        ErrorWatch::addBreadcrumb(
            message: 'Processing started',
            type: 'default',
            data: ['step' => 1, 'description' => 'validation']
        );

        ErrorWatch::addBreadcrumb(
            message: 'About to perform a risky operation',
            type: 'default',
            data: ['step' => 2, 'description' => 'risky_operation']
        );

        // This exception will be captured with the three breadcrumbs above attached.
        throw new RuntimeException(
            'Exception with breadcrumb trail. Check the "breadcrumbs" field in your ErrorWatch dashboard.'
        );
    }
}
