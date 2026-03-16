<?php

use App\Console\Commands\TestErrorCommand;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

/*
|--------------------------------------------------------------------------
| Console Routes
|--------------------------------------------------------------------------
|
| The TestErrorCommand (errorwatch:test) is auto-discovered via PSR-4.
| You can run it with:
|
|   php artisan errorwatch:test
|   php artisan errorwatch:test --message
|   php artisan errorwatch:test --breadcrumb
|
*/

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');
