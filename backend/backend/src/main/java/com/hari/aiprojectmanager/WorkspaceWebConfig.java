package com.hari.aiprojectmanager;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
class WorkspaceWebConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("http://localhost:5173")
                .allowedMethods("GET", "POST", "PUT", "PATCH", "OPTIONS")
                .allowedHeaders("Content-Type", "X-Workspace-Request")
                .allowCredentials(true);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
                String method = request.getMethod();
                if (RequestMethod.OPTIONS.name().equals(method)) return true;
                response.setHeader("Cache-Control", "no-store");
                if (!RequestMethod.GET.name().equals(method) && !RequestMethod.HEAD.name().equals(method)
                        && !"1".equals(request.getHeader("X-Workspace-Request"))) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing workspace request header.");
                }
                String path = request.getServletPath();
                if (path.equals("/api/auth/login")) return true;
                var session = request.getSession(false);
                if (session == null || !(session.getAttribute(WorkspaceAccount.SESSION_KEY) instanceof WorkspaceAccount)) {
                    throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in to continue.");
                }
                return true;
            }
        }).addPathPatterns("/api/**").excludePathPatterns("/api/health");
    }
}
