package com.example.server.web;
import com.example.server.model.DrillConfig;
import com.example.server.model.DrillSession;
import com.example.server.model.GuessResult;
import com.example.server.service.DrillService;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/drills")
public class DrillController {

    private final DrillService drillService;

    public DrillController(DrillService drillService) {
        this.drillService = drillService;
    }

    @PostMapping("/start")
    public StartDrillResponse startDrill(@RequestBody DrillConfig config) {
        DrillSession session = drillService.startDrill(config);
        return new StartDrillResponse(session.getSequence());
    }

    @PostMapping("/grade")
    public GuessResult gradeGuess(@RequestBody GradeRequest request) {
        return drillService.gradeGuess(request.sequence(), request.guessedCount());
    }
}
