<?php

declare(strict_types=1);

namespace App\Controller;

use ErrorWatch\Symfony\Model\Breadcrumb;
use ErrorWatch\Symfony\Service\BreadcrumbService;
use ErrorWatch\Symfony\Service\ErrorSenderInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class TestController extends AbstractController
{
    public function __construct(
        private readonly ErrorSenderInterface $errorSender,
        private readonly BreadcrumbService $breadcrumbService,
    ) {
    }

    /**
     * Homepage — lists available test routes.
     */
    #[Route('/', name: 'home', methods: ['GET'])]
    public function index(): JsonResponse
    {
        return new JsonResponse([
            'app' => 'ErrorWatch Symfony Example',
            'routes' => [
                'GET /'            => 'This page — available test routes',
                'GET /error'       => 'Throws a RuntimeException (captured by ErrorWatch)',
                'GET /message'     => 'Manually sends a test error event',
                'GET /breadcrumb'  => 'Adds breadcrumbs then throws an exception',
            ],
        ]);
    }

    /**
     * Throws a RuntimeException to test automatic exception capture.
     * The ErrorWatch ExceptionSubscriber will capture and send this to the server.
     */
    #[Route('/error', name: 'test_error', methods: ['GET'])]
    public function error(): Response
    {
        throw new \RuntimeException('Test error from ErrorWatch Symfony example — this should be captured automatically.');
    }

    /**
     * Manually sends a test error event via the ErrorSender service.
     * Useful to verify the SDK configuration without actually crashing the request.
     */
    #[Route('/message', name: 'test_message', methods: ['GET'])]
    public function message(): JsonResponse
    {
        $exception = new \LogicException('Manual test event from ErrorWatch Symfony SDK.');

        $this->errorSender->send(
            throwable: $exception,
            url: '/message',
            level: 'warning',
            context: [
                'source' => 'manual_test',
                'description' => 'This event was sent manually via ErrorSender::send()',
            ],
        );

        return new JsonResponse([
            'status' => 'sent',
            'message' => 'Test event sent to ErrorWatch. Check your dashboard.',
        ]);
    }

    /**
     * Adds several breadcrumbs then throws an exception.
     * The breadcrumbs will be attached to the captured error event.
     */
    #[Route('/breadcrumb', name: 'test_breadcrumb', methods: ['GET'])]
    public function breadcrumb(): Response
    {
        // Simulate a user navigation trail
        $this->breadcrumbService->add(
            Breadcrumb::navigation('/', '/breadcrumb', 'User navigated to breadcrumb test')
        );

        // Simulate a user action
        $this->breadcrumbService->add(
            Breadcrumb::user('click_button', 'User clicked "Run test"', ['button' => 'run-test'])
        );

        // Simulate an outgoing HTTP call
        $this->breadcrumbService->add(
            Breadcrumb::http('GET', 'https://api.example.com/data', 200)
        );

        // Simulate a log entry before the crash
        $this->breadcrumbService->add(
            Breadcrumb::log('info', 'About to trigger breadcrumb test exception', ['step' => 3])
        );

        // Now throw — the subscriber will attach the breadcrumbs above to the error event
        throw new \RuntimeException(
            'Breadcrumb test exception — should arrive in ErrorWatch with 4 breadcrumbs attached.'
        );
    }
}
